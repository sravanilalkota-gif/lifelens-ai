/**
 * The "understanding" moment — this is the demo's build-up beat.
 * Steps light up one by one so the audience can SEE the pipeline:
 *   See → Understand → Extract → Prioritize → Act
 */
import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { Spinner } from './ConfirmCard';

const STEPS = [
  { label: 'Reading the image', icon: 'image' as const },
  { label: 'Understanding what it means', icon: 'brain' as const },
  { label: 'Extracting dates, subject & place', icon: 'target' as const },
  { label: 'Deciding priority', icon: 'flag' as const },
  { label: 'Turning it into actions', icon: 'bolt' as const },
];

export function AnalyzingOverlay({ active }: { active: boolean }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!active) {
      setStep(0);
      return;
    }
    const timers = STEPS.map((_, i) => window.setTimeout(() => setStep(i), 420 * (i + 1)));
    return () => timers.forEach(window.clearTimeout);
  }, [active]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[55] grid place-items-center bg-ink-900/45 px-6 backdrop-blur-[3px] animate-fade-in">
      <div className="w-full max-w-[360px] rounded-4xl bg-white p-6 shadow-lift animate-pop">
        <div className="mb-5 flex items-center gap-3">
          <div className="relative grid h-12 w-12 place-items-center rounded-2xl gradient-brand text-white">
            <Icon name="sparkles" size={22} />
          </div>
          <div>
            <p className="text-[15px] font-bold text-ink-900">Understanding your capture…</p>
            <p className="text-[12px] text-ink-400">LifeLens is reading the meaning, not just the text</p>
          </div>
        </div>

        <ol className="space-y-2.5">
          {STEPS.map((s, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li
                key={s.label}
                className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition ${
                  current ? 'bg-brand-50 text-brand-800' : done ? 'text-ink-500' : 'text-ink-300'
                }`}
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition ${
                    done
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-600'
                      : current
                        ? 'border-brand-300 bg-white text-brand-600'
                        : 'border-ink-100 bg-ink-50 text-ink-300'
                  }`}
                >
                  {done ? <Icon name="check" size={14} strokeWidth={3} /> : current ? <Spinner className="h-3.5 w-3.5" /> : <Icon name={s.icon} size={14} />}
                </span>
                <span className="text-[13.5px] font-medium">{s.label}</span>
              </li>
            );
          })}
        </ol>

        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-ink-100">
          <div
            className="h-full rounded-full gradient-brand transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
