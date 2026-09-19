/**
 * LifeLens — Gemini multimodal vision service.
 *
 * Sends the image + a strict "act, don't OCR" system instruction to Gemini and
 * coerces whatever comes back into a validated AnalysisResult.
 *
 * Every failure mode here throws a typed error; the caller (routes/analyze)
 * catches it and falls back to Demo Mode so the user NEVER sees a raw API error.
 */
import type { AnalysisResult, Category, Priority } from '@lifelens/shared';
import { CATEGORIES, PRIORITIES } from '@lifelens/shared';
import { computePriority, suggestReminder } from '../engines/priorityEngine.js';
import { isIsoDate, isIsoTime, normTime } from '../lib/dates.js';

export class AiError extends Error {
  constructor(message: string, public readonly kind: string) {
    super(message);
    this.name = 'AiError';
  }
}

const SYSTEM_INSTRUCTION = `You are LifeLens, a visual personal assistant for a college student.
You are given ONE image from the user's camera (a notice, poster, timetable, assignment sheet, receipt, prescription, ticket, etc).

Your job is NOT to transcribe the image. Your job is to UNDERSTAND it and decide what the user should DO.

Return ONLY a single valid JSON object — no markdown, no code fences, no commentary — with EXACTLY these keys:

{
  "title": "short human title for this item (max 8 words)",
  "description": "1-2 sentence plain summary of what this document means for the user",
  "category": "one of: Academic | Assignment | Event | Finance | Health | Personal | Travel | Other",
  "subject": "the subject/topic/brand if stated, else null",
  "date": "YYYY-MM-DD of the event/deadline, else null",
  "time": "HH:mm in 24-hour format, else null",
  "location": "venue/room/place if stated, else null",
  "priority": "HIGH | MEDIUM | LOW",
  "confidence": 0.0-1.0 number,
  "action": "the single most useful next action, phrased as an instruction to the user",
  "reminder": "YYYY-MM-DD to remind the user (before the event), else null",
  "tasks": ["3-5 concrete checklist steps derived from this capture"],
  "sourceText": "the literal text you read from the image, kept short",
  "uncertainFields": ["names of keys you were NOT sure about, e.g. date"]
}

ABSOLUTE RULES:
1. NEVER invent a date, time, location, amount or deadline. If it is not clearly in the image, use null and list that key in "uncertainFields".
2. Resolve relative dates ("Monday", "next week") against TODAY = {TODAY}. Prefer null over a guess.
3. "priority" must reflect deadline proximity + importance: exam/fee within 3 days = HIGH, within 2 weeks = MEDIUM, optional or far away = LOW.
4. "tasks" must be things the user can actually DO, in their voice ("Revise DBMS Unit 3"), not descriptions of the image.
5. If the image is not readable or contains no useful information, return confidence <= 0.3, empty tasks, and explain in "description".`;

export interface GeminiOptions {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
}

/** Convert a `data:image/png;base64,xxxx` data URL into a Gemini inline part. */
function toInlinePart(dataUrl: string): { inlineData: { mimeType: string; data: string } } {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z+.-]+);base64,([\s\S]+)$/);
  if (!m) throw new AiError('Unsupported image format', 'invalid_image');
  return { inlineData: { mimeType: m[1], data: m[2] } };
}

export async function analyzeWithGemini(
  dataUrl: string,
  opts: GeminiOptions,
  todayIso: string,
): Promise<AnalysisResult> {
  console.log('[GEMINI TEST] analyzeWithGemini was called');
  console.log('[GEMINI TEST] model:', opts.model);
  console.log('[GEMINI TEST] key present:', Boolean(opts.apiKey));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000);

  let raw: any;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model ?? 'gemini-2.5-flash'}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
  'Content-Type': 'application/json',
  'x-goog-api-key': opts.apiKey,
},
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION.replace('{TODAY}', todayIso) }],
        },
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'Here is the image. Return the JSON object only.' },
              toInlinePart(dataUrl),
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          topP: 0.9,
          maxOutputTokens: 1600,
          responseMimeType: 'application/json',
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
  const body = await res.text().catch(() => '');

  console.error('[Gemini API ERROR]', res.status, body);

  throw new AiError(
    `Gemini request failed (${res.status}): ${body.slice(0, 500)}`,
    res.status === 429
      ? 'rate_limited'
      : res.status === 401 || res.status === 403
        ? 'auth'
        : 'api_error',
  );
}
    raw = await res.json();
  } catch (e: any) {
    if (e instanceof AiError) throw e;
    if (e?.name === 'AbortError') throw new AiError('Gemini timed out', 'timeout');
    throw new AiError(e?.message ?? 'Gemini request failed', 'network');
  } finally {
    clearTimeout(timer);
  }

  const text: string | undefined = raw?.candidates?.[0]?.content?.parts
    ?.map((p: any) => p?.text ?? '')
    .join('')
    .trim();

  if (!text) {
    const reason = raw?.promptFeedback?.blockReason ?? raw?.candidates?.[0]?.finishReason;
    throw new AiError(`Gemini returned an empty response${reason ? ` (${reason})` : ''}`, 'empty_response');
  }

  const parsed = safeJsonParse(text);
  if (!parsed) throw new AiError('Gemini returned invalid JSON', 'invalid_json');

  return normalizeGeminiOutput(parsed, todayIso);
}

function safeJsonParse(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    // models sometimes wrap JSON in ```json ... ``` — salvage it
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      try {
        return JSON.parse(fenced[1]);
      } catch {
        /* fall through */
      }
    }
    const braced = text.match(/\{[\s\S]*\}/);
    if (braced) {
      try {
        return JSON.parse(braced[0]);
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}

/**
 * Validate + coerce the model output. This is the security/trust boundary:
 * nothing from the model reaches the database without passing through here.
 */
export function normalizeGeminiOutput(parsed: any, todayIso: string): AnalysisResult {
  if (!parsed || typeof parsed !== 'object') throw new AiError('Model output was not an object', 'invalid_json');

  const category: Category = CATEGORIES.includes(parsed.category)
    ? parsed.category
    : (guessCategory(String(parsed.title ?? '') + ' ' + String(parsed.description ?? '')) as Category);

  const rawPriority = String(parsed.priority ?? '').toUpperCase();
  const aiPriority: Priority = (PRIORITIES as string[]).includes(rawPriority)
    ? (rawPriority as Priority)
    : 'MEDIUM';

  const date = isIsoDate(parsed.date) ? parsed.date : null;
  const reminder = isIsoDate(parsed.reminder) ? parsed.reminder : null;
  const time = normTime(parsed.time);
  const confidenceRaw = Number(parsed.confidence);
  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0.5;

  const tasks = Array.isArray(parsed.tasks)
    ? parsed.tasks
        .filter((t: unknown) => typeof t === 'string' && t.trim().length > 2)
        .map((t: string) => sanitize(t).slice(0, 120))
        .slice(0, 6)
    : [];

  const uncertainFields: string[] = Array.isArray(parsed.uncertainFields)
    ? parsed.uncertainFields.filter((f: unknown) => typeof f === 'string').slice(0, 6)
    : [];
  if (!date && !uncertainFields.includes('date')) uncertainFields.push('date');
  if (!time && !uncertainFields.includes('time')) uncertainFields.push('time');

  // The model's priority is only a VOTE — our own engine has the final say,
  // which is what makes the priority engine explainable.
  const computed = computePriority({
    date,
    time,
    category,
    aiPriority,
    text: `${parsed.title ?? ''} ${parsed.description ?? ''} ${parsed.sourceText ?? ''}`,
  });

  return {
    title: sanitize(String(parsed.title ?? 'Untitled capture')).slice(0, 90) || 'Untitled capture',
    description: parsed.description ? sanitize(String(parsed.description)).slice(0, 400) : null,
    category,
    subject: parsed.subject ? sanitize(String(parsed.subject)).slice(0, 60) : null,
    date,
    time: time && isIsoTime(time) ? time : null,
    location: parsed.location ? sanitize(String(parsed.location)).slice(0, 80) : null,
    priority: computed.priority,
    confidence,
    action: parsed.action ? sanitize(String(parsed.action)).slice(0, 160) : null,
    reminder: reminder ?? suggestReminder(date, category),
    tasks,
    priorityReason: computed.reason,
    uncertainFields,
    sourceText: parsed.sourceText ? sanitize(String(parsed.sourceText)).slice(0, 1200) : null,
    aiMode: 'gemini',
    note: 'Analysed with Gemini • priority recalculated by the LifeLens engine',
  };
}

function guessCategory(text: string): Category | 'Other' {
  if (/\b(exam|syllabus|semester|attendance|timetable)\b/i.test(text)) return 'Academic';
  if (/\b(assignment|submit|deadline)\b/i.test(text)) return 'Assignment';
  if (/\b(workshop|seminar|fest|event)\b/i.test(text)) return 'Event';
  if (/\b(fee|payment|invoice|receipt|bill)\b/i.test(text)) return 'Finance';
  if (/\b(appointment|doctor|clinic|medicine)\b/i.test(text)) return 'Health';
  if (/\b(flight|train|ticket|pnr)\b/i.test(text)) return 'Travel';
  return 'Other';
}

/** Strip control chars, angle brackets and script-ish content coming from the model. */
export function sanitize(input: string): string {
  return String(input)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/<\s*\/?\s*(script|style|iframe|object|embed)[^>]*>/gi, '')
    .replace(/[<>]/g, '')
    .trim();
}
