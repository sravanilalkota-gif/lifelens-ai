/**
 * Profile — demo user, AI mode, data controls, and the pitch in one screen.
 */
import { useState } from 'react';
import { useLifeLens } from '../hooks/useLifeLens';
import { Icon } from '../components/Icon';
import { SectionHeader } from '../components/Cards';
import { useToast } from '../components/Toast';
import { initials } from '../lib/format';
import type { Page } from '../App';

export function ProfilePage({ onNavigate, onAsk }: { onNavigate: (p: Page) => void; onAsk: () => void }) {
  const { user, health, aiMode, captures, tasks, resetDemo, clearAll } = useLifeLens();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const doneCount = tasks.filter((t) => t.done).length;

  async function run(key: string, fn: () => Promise<string>, message: string) {
    setBusy(key);
    try {
      await fn();
      toast.push(message, 'success');
    } catch (e: any) {
      toast.push(e?.message ?? 'That did not work. Please try again.', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="animate-fade-in">
      {/* profile header */}
      <header className="px-5 pb-2 pt-8">
        <div className="card overflow-hidden">
          <div className="gradient-brand px-5 pb-6 pt-6 text-white">
            <div className="flex items-center gap-3.5">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/20 text-[19px] font-extrabold backdrop-blur">
                {initials(user.name)}
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-[20px] font-extrabold tracking-tight">{user.name}</h1>
                <p className="text-[13px] text-white/85">{user.course}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-ink-100">
            <Metric label="Captures" value={captures.length} />
            <Metric label="Open tasks" value={tasks.filter((t) => !t.done).length} />
            <Metric label="Completed" value={doneCount} />
          </div>
        </div>
      </header>

      {/* AI status */}
      <section className="px-5 pt-5">
        <SectionHeader title="AI engine" subtitle="Which brain is running right now" />
        <div className="card card-pad">
          <div className="flex items-start gap-3">
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white ${
                aiMode === 'gemini' ? 'bg-emerald-500' : 'gradient-brand'
              }`}
            >
              <Icon name={aiMode === 'gemini' ? 'sparkles' : 'brain'} size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-bold text-ink-900">
                {aiMode === 'gemini' ? `Live — ${health?.model ?? 'Gemini'}` : 'Demo Mode'}
              </p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-500">
                {aiMode === 'gemini'
                  ? 'Images are analysed by the Gemini multimodal model through the LifeLens API. The key never leaves the server.'
                  : 'No GEMINI_API_KEY is set, so LifeLens is using its built-in understanding engine with bundled sample documents. Everything still works — add a key in .env to switch to live vision.'}
              </p>
            </div>
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-2.5 text-[12px]">
            <InfoTile label="API key" value={health?.hasApiKey ? 'Configured' : 'Not set'} ok={Boolean(health?.hasApiKey)} />
            <InfoTile label="Server" value={health ? 'Online' : 'Offline'} ok={Boolean(health)} />
          </div>
        </div>
      </section>

      {/* shortcuts */}
      <section className="px-5 pt-5">
        <SectionHeader title="Shortcuts" />
        <div className="card divide-y divide-ink-100">
          <Row icon="mic" label="Ask LifeLens" hint="Voice or text" onClick={onAsk} />
          <Row icon="camera" label="Scan something" hint="Camera or upload" onClick={() => onNavigate('capture')} />
          <Row icon="sparkles" label="Today’s plan" hint="AI-ordered day" onClick={() => onNavigate('plan')} />
          <Row icon="calendar" label="Calendar" hint="Deadlines & events" onClick={() => onNavigate('calendar')} />
          <Row icon="list" label="My captures" hint="Visual memory" onClick={() => onNavigate('captures')} />
        </div>
      </section>

      {/* data controls */}
      <section className="px-5 pt-5">
        <SectionHeader title="Demo data" subtitle="Perfect for resetting between judge demos" />
        <div className="card divide-y divide-ink-100">
          <Row
            icon="refresh"
            label="Restore sample captures"
            hint={busy === 'reset' ? 'Restoring…' : 'DBMS exam, OS assignment, workshop, timetable, fee'}
            onClick={() => void run('reset', resetDemo, 'Sample captures restored.')}
          />
          <Row
            icon="trash"
            label="Clear everything"
            hint={busy === 'clear' ? 'Clearing…' : 'Start from a completely empty LifeLens'}
            danger
            onClick={() => void run('clear', clearAll, 'All data cleared.')}
          />
        </div>
      </section>

      {/* about */}
      <section className="px-5 pt-5">
        <div className="card card-pad border-brand-100 bg-gradient-to-b from-brand-50/70 to-white">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-600">LifeLens AI</p>
          <p className="mt-1.5 text-[15px] font-bold leading-snug text-ink-900">
            See → Understand → Extract → Prioritize → Act
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
            LifeLens doesn’t just tell you what it sees. It tells you what you should do about it.
          </p>
          <p className="mt-3 text-[11.5px] text-ink-300">Hack Devengers 2.0 • built for the 24-hour hackathon</p>
        </div>
      </section>

      <div className="h-8" />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-2 py-3.5 text-center">
      <p className="text-[19px] font-extrabold text-ink-900">{value}</p>
      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</p>
    </div>
  );
}

function InfoTile({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-ink-100 bg-ink-50/60 px-3 py-2.5">
      <span className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden />
      <span className="text-ink-400">{label}:</span>
      <span className="font-bold text-ink-800">{value}</span>
    </div>
  );
}

function Row({
  icon,
  label,
  hint,
  onClick,
  danger,
}: {
  icon: 'mic' | 'camera' | 'sparkles' | 'calendar' | 'list' | 'refresh' | 'trash';
  label: string;
  hint?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-ink-50 ${
        danger ? 'text-rose-600' : 'text-ink-800'
      }`}
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${danger ? 'bg-rose-50' : 'bg-brand-50 text-brand-600'}`}>
        <Icon name={icon} size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold">{label}</span>
        {hint && <span className="block truncate text-[11.5px] text-ink-400">{hint}</span>}
      </span>
      <Icon name="chevronRight" size={16} className="shrink-0 text-ink-300" />
    </button>
  );
}
