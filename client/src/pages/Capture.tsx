/**
 * Capture — the most important screen in LifeLens.
 *
 * Camera → preview → "Understand with LifeLens" → confirmation card → tasks.
 * Works three ways so a live demo can never stall:
 *   1. real camera (getUserMedia, when the browser allows it)
 *   2. file upload / phone camera sheet (`capture="environment"`)
 *   3. bundled sample documents (Demo Mode)
 */
import { useEffect, useRef, useState } from 'react';
import type { AnalysisResult } from '@lifelens/shared';
import { useLifeLens } from '../hooks/useLifeLens';
import { Icon } from '../components/Icon';
import { AnalyzingOverlay } from '../components/AnalyzingOverlay';
import { ConfirmCard, Notice } from '../components/ConfirmCard';
import { useToast } from '../components/Toast';
import type { Page } from '../App';

const MAX_MB = 6;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

const SAMPLES = [
  { key: 'dbms-internal-exam', label: '📚 DBMS Internal Exam Notice' },
  { key: 'os-assignment', label: '📝 OS Assignment Notice' },
  { key: 'ai-workshop', label: '🎓 AI Workshop Poster' },
  { key: 'timetable', label: '🗓️ College Timetable' },
  { key: 'fee-payment', label: '💳 Fee Payment Reminder' },
];

/** Load a bundled sample document so the confirmation card shows a real image. */
async function loadSampleImage(key: string): Promise<string | null> {
  try {
    const res = await fetch(`/samples/${key}.jpg`);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function CapturePage({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { analyze, aiMode } = useLifeLens();
  const toast = useToast();

  const [image, setImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const liveRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => stopCamera(), []); // eslint-disable-line react-hooks/exhaustive-deps

  /* --------------------------------- camera -------------------------------- */

  async function startCamera() {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('This browser can’t open the camera here. Use “Upload image” instead — on a phone it opens the camera app.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
      });
    } catch {
      setCameraError('Camera permission was denied. Use “Upload image” — it opens your phone camera too.');
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  function snapPhoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 960;
    const scale = Math.min(1, 1600 / w);
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
    stopCamera();
    setImage(dataUrl);
    setImageName('camera-capture.jpg');
    setResult(null);
    setError(null);
  }

  /* --------------------------------- upload -------------------------------- */

  function readFile(file: File) {
    setError(null);
    if (!ACCEPTED.includes(file.type)) {
      setError('That file type is not supported. Please use a JPG, PNG or WEBP photo.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`That image is ${Math.round(file.size / 1024 / 1024)} MB. Please use one under ${MAX_MB} MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImage(String(reader.result));
      setImageName(file.name);
      setResult(null);
    };
    reader.onerror = () => setError('LifeLens could not read that file. Please try another image.');
    reader.readAsDataURL(file);
  }

  /* -------------------------------- analyze -------------------------------- */

  async function understand(payload: {
    image?: string;
    demoKey?: string;
    fileName?: string;
    /** image to show in the confirmation card (used by the bundled samples) */
    previewImage?: string | null;
  }) {
    setAnalyzing(true);
    setError(null);
    setFallback(null);
    if (payload.previewImage) {
      setImage(payload.previewImage);
      setImageName(`${payload.demoKey ?? 'sample'}.jpg`);
    }
    try {
      const res = await analyze(payload);
      setResult(res.result);
      if (res.fallback) setFallback('The live vision model was unavailable, so LifeLens used its built-in understanding engine.');
      if (res.result.confidence < 0.35) {
        toast.push('LifeLens is not fully sure about this one — please check the highlighted fields.', 'info');
      }
    } catch (e: any) {
      setError(e?.message ?? 'LifeLens couldn’t understand that image clearly. Try taking a clearer photo.');
    } finally {
      setAnalyzing(false);
    }
  }

  function reset() {
    setImage(null);
    setImageName(null);
    setResult(null);
    setFallback(null);
    setError(null);
  }

  /* ---------------------------------- view --------------------------------- */

  return (
    <div className="animate-fade-in">
      <header className="px-5 pb-2 pt-7">
        <h1 className="text-[24px] font-extrabold tracking-tight text-ink-900">Capture</h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-500">
          Point LifeLens at a notice, poster, timetable or receipt. It reads the <em>meaning</em> and creates actions.
        </p>
        <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-ink-100 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-ink-500">
          <Icon name={aiMode === 'gemini' ? 'sparkles' : 'brain'} size={13} className="text-brand-600" />
          {aiMode === 'gemini' ? 'Live Gemini vision' : 'Demo Mode — built-in understanding engine'}
        </span>
      </header>

      <div className="space-y-4 px-5 pt-4">
        {/* preview / drop zone */}
        {image ? (
          <div className="card overflow-hidden animate-pop">
            <div className="relative">
              <img src={image} alt="Selected capture" className="max-h-[320px] w-full object-contain bg-ink-100" />
              <button
                onClick={reset}
                className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-ink-900/55 text-white backdrop-blur transition hover:bg-ink-900/75"
                aria-label="Remove image"
              >
                <Icon name="close" size={17} />
              </button>
              {imageName && (
                <span className="absolute bottom-3 left-3 max-w-[70%] truncate rounded-full bg-ink-900/55 px-3 py-1.5 text-[11.5px] font-medium text-white backdrop-blur">
                  {imageName}
                </span>
              )}
            </div>

            <div className="p-4">
              <button className="btn-primary w-full" onClick={() => void understand({ image, fileName: imageName ?? undefined })}>
                <Icon name="sparkles" size={18} /> Understand with LifeLens
              </button>
              <button className="mt-2.5 w-full text-[13px] font-semibold text-ink-400 transition hover:text-ink-700" onClick={reset}>
                Choose a different image
              </button>
            </div>
          </div>
        ) : cameraOn ? (
          <div className="card overflow-hidden animate-pop">
            <div className="relative bg-ink-900">
              <video ref={videoRef} playsInline muted className="max-h-[380px] w-full object-cover" />
              {/* viewfinder frame */}
              <div className="pointer-events-none absolute inset-6 rounded-3xl border-2 border-white/70" aria-hidden>
                <span className="absolute left-0 top-1/2 h-px w-full bg-white/40 animate-scan-line" />
              </div>
              <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[12px] font-medium text-white/85">
                Hold the notice steady and fill the frame
              </p>
            </div>
            <div className="flex gap-2.5 p-4">
              <button className="btn-ghost flex-1" onClick={stopCamera}>
                Cancel
              </button>
              <button className="btn-primary flex-[1.5]" onClick={snapPhoto}>
                <Icon name="camera" size={18} /> Capture
              </button>
            </div>
          </div>
        ) : (
          <div className="card p-5 animate-fade-up">
            <div className="grid h-16 w-16 place-items-center rounded-3xl gradient-brand text-white shadow-brand">
              <Icon name="camera" size={28} />
            </div>
            <h2 className="mt-4 text-[17px] font-bold text-ink-900">Show LifeLens something</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
              A photo of a college notice works best. JPG, PNG or WEBP up to {MAX_MB} MB.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button className="btn-primary" onClick={() => void startCamera()}>
                <Icon name="camera" size={18} /> Open camera
              </button>
              <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
                <Icon name="upload" size={18} /> Upload image
              </button>
            </div>

            <button
              className="mt-2.5 w-full rounded-2xl border border-dashed border-ink-200 bg-ink-50/60 px-4 py-3 text-[13px] font-semibold text-ink-500 transition hover:border-brand-200 hover:text-brand-700"
              onClick={() => liveRef.current?.click()}
            >
              📱 Use phone camera (opens the camera app)
            </button>

            {cameraError && (
              <div className="mt-3">
                <Notice tone="warn" title="Camera unavailable">
                  {cameraError}
                </Notice>
              </div>
            )}
          </div>
        )}

        {error && (
          <Notice tone="error" title="LifeLens couldn’t understand this image">
            {error}
          </Notice>
        )}

        {/* -------------------------- demo samples -------------------------- */}
        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <Icon name="book" size={16} />
            </span>
            <div>
              <p className="text-[14px] font-bold text-ink-900">Sample documents</p>
              <p className="text-[11.5px] text-ink-400">Tap one to see the full See → Understand → Act flow</p>
            </div>
          </div>
          <div className="space-y-2">
            {SAMPLES.map((s) => (
              <button
                key={s.key}
                disabled={Boolean(demoBusy)}
                onClick={() => {
                  setDemoBusy(s.key);
                  void (async () => {
                    const previewImage = await loadSampleImage(s.key);
                    await understand({ demoKey: s.key, previewImage });
                  })().finally(() => setDemoBusy(null));
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-ink-100 bg-ink-50/60 px-3.5 py-3 text-left transition hover:border-brand-200 hover:bg-brand-50/60 disabled:opacity-60"
              >
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink-700">{s.label}</span>
                {demoBusy === s.key ? (
                  <span className="text-[11px] font-bold text-brand-600">Reading…</span>
                ) : (
                  <Icon name="chevronRight" size={16} className="shrink-0 text-ink-300" />
                )}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => onNavigate('captures')}
          className="flex w-full items-center justify-center gap-2 py-2 text-[13px] font-semibold text-ink-400 transition hover:text-brand-700"
        >
          <Icon name="list" size={15} /> My captures
        </button>
      </div>

      {/* hidden inputs */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) readFile(f);
          e.target.value = '';
        }}
      />
      <input
        ref={liveRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) readFile(f);
          e.target.value = '';
        }}
      />

      <AnalyzingOverlay active={analyzing} />

      <ConfirmCard
        open={Boolean(result)}
        result={result}
        imageData={image}
        imageName={imageName}
        fallbackNotice={fallback}
        onClose={() => setResult(null)}
        onSaved={() => {
          setResult(null);
          reset();
          toast.push('Saved to your tasks — check “Today’s plan”.', 'success');
          onNavigate('plan');
        }}
      />
    </div>
  );
}
