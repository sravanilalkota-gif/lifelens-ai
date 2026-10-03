/**
 * POST /api/analyze
 *
 * The heart of LifeLens: image → structured understanding.
 *
 * Order of operations:
 *   1. Validate the payload (type + size) — never trust the client.
 *   2. If a Gemini key exists → real multimodal vision.
 *   3. Any failure at all → Demo Mode fallback (never surface a raw API error).
 *   4. Re-run the Smart Priority Engine so priority is always explainable.
 */
import { Router } from 'express';
import type { AnalyzeRequest, AnalyzeResponse, AnalysisResult } from '@lifelens/shared';
import { AiError, analyzeWithGemini } from '../ai/gemini.js';
import { analyzeText } from '../ai/demoAnalyzer.js';
import { computePriority, suggestReminder } from '../engines/priorityEngine.js';
import { localDateKey } from '../lib/dates.js';
import { demoDocs } from '../data/demoData.js';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export function analyzeRouter(getEnv: () => { apiKey: string; model: string }): Router {
  const r = Router();

  r.post('/', async (req, res) => {
    const body = (req.body ?? {}) as AnalyzeRequest;
    const { image, demoKey, text, fileName } = body;

    /* ------------------------------- validation ----------------------------- */
    if (!image && !demoKey && !text) {
      const resp: AnalyzeResponse = {
        ok: false,
        error: 'Nothing to understand yet. Take a photo, upload an image, or paste the text from it.',
      };
      return res.status(400).json(resp);
    }

    if (image && typeof image === 'string') {
      const mime = image.slice(5, image.indexOf(';'));
      if (!image.startsWith('data:') || !ALLOWED_MIME.has(mime.toLowerCase())) {
        return res.status(400).json({
          ok: false,
          error: 'That file type is not supported. Please use a JPG, PNG or WEBP image.',
        } satisfies AnalyzeResponse);
      }
      // ~750 KB of base64 ≈ 5.5 MB of image; express.json already caps the body.
      if (image.length > 9_000_000) {
        return res.status(413).json({
          ok: false,
          error: 'That image is too large. Please use one under 6 MB.',
        } satisfies AnalyzeResponse);
      }
    }

    const env = getEnv();
    const todayIso = localDateKey();

    /* ------------------------------ demo samples ---------------------------- */
    if (demoKey) {
      const doc = demoDocs.find((d) => d.key === demoKey);
      if (!doc) {
        return res.status(404).json({ ok: false, error: 'That sample document no longer exists.' } satisfies AnalyzeResponse);
      }
      const result = finalize(analyzeText({ demoKey: doc.key }), todayIso);
      return res.json({ ok: true, result, proposedTasks: result.tasks } satisfies AnalyzeResponse);
    }

    /* ------------------------------- real vision ---------------------------- */
    if (env.apiKey && image) {
      try {
        const result = await analyzeWithGemini(image, { apiKey: env.apiKey, model: env.model }, todayIso);
        return res.json({ ok: true, result, proposedTasks: result.tasks } satisfies AnalyzeResponse);
      } catch (err) {
        const e = err as AiError;
        console.warn(`[analyze] Gemini failed (${e.kind ?? 'unknown'}): ${e.message} — falling back to Demo Mode`);
        const fallback = analyzeText({ text: text ?? '', fileName });
        const result = finalize(fallback, todayIso);
        result.note = friendlyFallbackMessage(e);
        return res.json({ ok: true, result, proposedTasks: result.tasks, fallback: e.kind ?? 'api_error' } satisfies AnalyzeResponse);
      }
    }

    /* -------------------------------- demo mode ----------------------------- */
    const result = finalize(analyzeText({ text: text ?? '', fileName, demoKey: undefined }), todayIso);
    return res.json({ ok: true, result, proposedTasks: result.tasks } satisfies AnalyzeResponse);
  });

  return r;
}

/** Demo-mode results still get a final pass through the priority engine. */
function finalize(result: AnalysisResult, todayIso: string): AnalysisResult {
  const p = computePriority({
    date: result.date,
    time: result.time,
    category: result.category,
    aiPriority: result.priority,
    text: `${result.title} ${result.description ?? ''} ${result.sourceText ?? ''}`,
  });
  return {
    ...result,
    priority: p.priority,
    priorityReason: p.reason,
    reminder: result.reminder ?? suggestReminder(result.date, result.category),
    note: result.note ?? `Demo Mode • understood locally on ${todayIso}`,
  };
}

function friendlyFallbackMessage(e: AiError): string {
  switch (e.kind) {
    case 'auth':
      return 'LifeLens could not reach the vision model (invalid API key), so it used the built-in understanding engine instead. Please check the extracted details.';
    case 'rate_limited':
      return 'The vision model is busy right now, so LifeLens used its built-in understanding engine. Please check the extracted details.';
    case 'timeout':
      return 'The vision model took too long to respond, so LifeLens used its built-in understanding engine. Please check the extracted details.';
    case 'invalid_image':
      return 'LifeLens couldn’t read that image clearly. Try taking a clearer photo with more light.';
    case 'empty_response':
    case 'invalid_json':
      return 'LifeLens couldn’t understand this image clearly. Try taking a clearer photo — meanwhile here is a best guess you can edit.';
    default:
      return 'No internet connection to the vision model, so LifeLens used its built-in understanding engine. Please check the extracted details.';
  }
}
