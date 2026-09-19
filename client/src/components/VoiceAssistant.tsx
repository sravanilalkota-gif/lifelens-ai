/**
 * Voice assistant.
 *
 * Uses the browser's Web Speech API when available (Chrome / Edge / Safari) and
 * always offers a text fallback, so the demo never dead-ends on stage.
 * LifeLens answers from the user's OWN captured data via /api/assistant.
 */
import { useEffect, useRef, useState } from 'react';
import type { AssistantResponse } from '@lifelens/shared';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Spinner } from './ConfirmCard';
import { useLifeLens } from '../hooks/useLifeLens';

/* Web Speech API types (not in the default TS lib) */
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

const SUGGESTIONS = [
  'What do I need to finish today?',
  'What should I finish first?',
  'What is my next deadline?',
  'When is my DBMS exam?',
  'What exams are coming?',
  'Show me everything about DBMS',
  'What did I scan yesterday?',
];

export function useSpeechSupported() {
  return typeof window !== 'undefined' && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function VoiceAssistant({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ask } = useLifeLens();
  const supported = useSpeechSupported();

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [answer, setAnswer] = useState<AssistantResponse | null>(null);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speakBack, setSpeakBack] = useState(true);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      stopListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => stopListening(), []); // eslint-disable-line react-hooks/exhaustive-deps

  function startListening() {
    if (!supported) {
      setError('Voice input is not supported in this browser — just type your question below.');
      inputRef.current?.focus();
      return;
    }
    try {
      const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec: SpeechRecognitionLike = new Ctor();
      rec.lang = 'en-IN';
      rec.continuous = false;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let text = '';
        for (let i = e.resultIndex; i < e.results.length; i += 1) {
          text += e.results[i][0].transcript;
        }
        setTranscript(text);
        if (e.results[e.results.length - 1]?.isFinal) {
          setListening(false);
          void submit(text);
        }
      };
      rec.onerror = (e) => {
        setListening(false);
        setError(
          e?.error === 'not-allowed'
            ? 'Microphone access was blocked. Allow it in your browser, or type the question instead.'
            : 'I could not hear that clearly — try again, or type your question.',
        );
      };
      rec.onend = () => setListening(false);
      recRef.current = rec;
      setTranscript('');
      setError(null);
      setAnswer(null);
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
      setError('Voice input could not start in this browser — please type your question.');
    }
  }

  function stopListening() {
    try {
      recRef.current?.abort();
    } catch {
      /* noop */
    }
    setListening(false);
  }

  async function submit(questionRaw?: string) {
    const question = (questionRaw ?? transcript).trim();
    if (!question) return;
    setThinking(true);
    setError(null);
    setTranscript(question);
    try {
      const res = await ask(question);
      setAnswer(res);
      if (speakBack) speak(res.answer);
    } catch (e: any) {
      setError(e?.message ?? 'LifeLens could not answer that right now. Please try again.');
    } finally {
      setThinking(false);
    }
  }

  function speak(text: string) {
    try {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text.replace(/\n+/g, '. '));
      utter.lang = 'en-IN';
      utter.rate = 1.02;
      window.speechSynthesis.speak(utter);
    } catch {
      /* speaking is a nice-to-have */
    }
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        try {
          window.speechSynthesis?.cancel();
        } catch {
          /* noop */
        }
        onClose();
      }}
      title="Ask LifeLens"
      subtitle="Ask about anything you have scanned — deadlines, exams, plans or memories."
      footer={
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            className="input py-3"
            placeholder={supported ? 'Type a question…' : 'Type your question here…'}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            aria-label="Ask LifeLens a question"
          />
          <button type="submit" className="btn-primary shrink-1 px-4" disabled={thinking || !transcript.trim()} aria-label="Send">
            {thinking ? <Spinner /> : <Icon name="send" size={18} />}
          </button>
        </form>
      }
    >
      {/* mic */}
      <div className="mb-4 flex flex-col items-center py-2">
        <button
          onClick={() => (listening ? stopListening() : startListening())}
          aria-label={listening ? 'Stop listening' : 'Start voice question'}
          className={`relative grid h-20 w-20 place-items-center rounded-full text-white transition active:scale-95 ${
            listening ? 'bg-rose-500 shadow-[0_12px_30px_-10px_rgba(244,63,94,0.6)]' : 'gradient-brand shadow-brand'
          }`}
        >
          {listening && <span className="absolute inset-0 rounded-full bg-rose-400/40 animate-pulse-ring" aria-hidden />}
          <Icon name={listening ? 'stop' : 'mic'} size={30} strokeWidth={1.9} />
        </button>
        <p className="mt-3 text-[13px] font-semibold text-ink-700">
          {listening ? 'Listening… speak now' : supported ? 'Tap to speak' : 'Voice input unavailable — type below'}
        </p>
        <p className="mt-0.5 max-w-[16rem] text-center text-[12px] text-ink-400">
          {supported
            ? 'Works best in Chrome or Edge. LifeLens will also read the answer aloud.'
            : 'This browser has no speech recognition, so use the text box — same answers.'}
        </p>

        <label className="mt-3 inline-flex items-center gap-2 text-[12px] font-medium text-ink-500">
          <input
            type="checkbox"
            checked={speakBack}
            onChange={(e) => setSpeakBack(e.target.checked)}
            className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-400"
          />
          Read answers aloud
        </label>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12.5px] leading-relaxed text-amber-800">
          {error}
        </div>
      )}

      {thinking && (
        <div className="mb-4 flex items-center gap-2.5 rounded-2xl bg-brand-50 px-4 py-3 text-[13px] font-medium text-brand-700">
          <Spinner className="h-4 w-4" /> LifeLens is thinking about your captures…
        </div>
      )}

      {answer && !thinking && (
        <div className="mb-4 rounded-2xl border border-brand-100 bg-gradient-to-b from-brand-50/80 to-white p-4 animate-fade-up">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-600">
            <Icon name="sparkles" size={13} /> LifeLens
          </p>
          <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink-800">{answer.answer}</p>
        </div>
      )}

      <div>
        <p className="label">Try asking</p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setTranscript(s);
                void submit(s);
              }}
              className="rounded-full border border-ink-100 bg-ink-50 px-3 py-2 text-[12.5px] font-medium text-ink-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
