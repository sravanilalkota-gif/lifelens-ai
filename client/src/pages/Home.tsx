import { useMemo } from 'react';
import type { Task } from '@lifelens/shared';
import { CATEGORY_EMOJI, PRIORITY_META, daysUntil } from '@lifelens/shared';
import { useLifeLens, usePriorities } from '../hooks/useLifeLens';
import { Icon } from '../components/Icon';
import { CaptureCard, EmptyState, SectionHeader, TaskCard } from '../components/Cards';
import { PriorityBadge } from '../components/Badges';
import { dueCopy, greeting, initials } from '../lib/format';
import type { Page } from '../App';
import { TaskDetail } from '../components/TaskDetail';
import { useState } from 'react';

export function HomePage({ onNavigate, onAsk }: { onNavigate: (p: Page) => void; onAsk: () => void }) {
  const { user, aiMode, loading, health } = useLifeLens();
  const { open, today, upcoming, done } = usePriorities();
  const [openTask, setOpenTask] = useState<Task | null>(null);

  const top = useMemo(() => upcoming.slice(0, 3), [upcoming]);
  const nextUp = useMemo(() => upcoming.filter((t) => !top.includes(t)).slice(0, 3), [upcoming, top]);

  return (
    <div className="animate-fade-in">
      {/* ------------------------------- header ------------------------------ */}
      <header className="relative overflow-hidden rounded-b-[2rem] gradient-brand px-5 pb-7 pt-6 text-white">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-[2px]"
          aria-hidden
        />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-52 w-52 rounded-full bg-violet-400/25" aria-hidden />

        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-white/75">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="mt-0.5 text-[26px] font-extrabold leading-tight tracking-tight">
              {greeting()}, {user.name} 👋
            </h1>
            <p className="mt-1 text-[13px] text-white/80">{user.course}</p>
          </div>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15 text-[15px] font-bold backdrop-blur">
            {initials(user.name)}
          </div>
        </div>

        {/* status line */}
        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11.5px] font-semibold backdrop-blur">
            <Icon name={aiMode === 'gemini' ? 'sparkles' : 'brain'} size={13} />
            {aiMode === 'gemini' ? `Live AI • ${health?.model ?? 'Gemini'}` : 'Demo Mode • built-in engine'}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11.5px] font-semibold backdrop-blur">
            <Icon name="image" size={13} />
            {health?.counts.captures ?? 0} captures
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11.5px] font-semibold backdrop-blur">
            <Icon name="check" size={13} />
            {done.length} done
          </span>
        </div>

        {/* ------------------------- primary scan action ------------------------ */}
        <button
          onClick={() => onNavigate('capture')}
          className="relative mt-5 flex w-full items-center gap-3.5 rounded-3xl bg-white p-3.5 text-left shadow-lift transition active:scale-[0.98]"
        >
          <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl gradient-brand text-white shadow-brand">
            <span className="absolute inset-0 rounded-2xl bg-brand-500/40 animate-pulse-ring" aria-hidden />
            <Icon name="camera" size={26} strokeWidth={1.9} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-bold text-ink-900">Scan something</span>
            <span className="block text-[12.5px] text-ink-500">
              Notice, poster, timetable or receipt — LifeLens turns it into actions
            </span>
          </span>
          <Icon name="chevronRight" size={18} className="shrink-0 text-ink-300" />
        </button>
      </header>

      {/* ----------------------------- quick actions --------------------------- */}
      <section className="px-5 pt-5">
        <div className="grid grid-cols-4 gap-2.5">
          <QuickAction icon="camera" label="Scan" tint="from-brand-500 to-violet-500" onClick={() => onNavigate('capture')} />
          <QuickAction icon="upload" label="Upload" tint="from-sky-500 to-cyan-500" onClick={() => onNavigate('capture')} />
          <QuickAction icon="mic" label="Ask" tint="from-amber-500 to-orange-500" onClick={onAsk} />
          <QuickAction icon="tasks" label="All tasks" tint="from-emerald-500 to-teal-500" onClick={() => onNavigate('tasks')} />
        </div>
      </section>

      {/* --------------------------- today's priorities ------------------------ */}
      <section className="px-5 pt-6">
        <SectionHeader
          title="Today’s priorities"
          subtitle={
            today.length
              ? `${today.length} item${today.length === 1 ? '' : 's'} need attention right now`
              : 'Nothing due today — here is what is coming up'
          }
          action="View all"
          onAction={() => onNavigate('tasks')}
        />

        {loading ? (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-[74px]" />
            ))}
          </div>
        ) : top.length === 0 ? (
          <EmptyState
            emoji="📷"
            title="Your LifeLens is empty"
            body="Scan a college notice, poster or assignment sheet and LifeLens will turn it into tasks, reminders and priorities."
            action="Scan your first item"
            onAction={() => onNavigate('capture')}
          />
        ) : (
          <div className="space-y-2.5">
            {top.map((t) => (
              <PriorityRow key={t.id} task={t} onOpen={() => setOpenTask(t)} />
            ))}
          </div>
        )}
      </section>

      {/* --------------------------- today's plan CTA -------------------------- */}
      <section className="px-5 pt-6">
        <button
          onClick={() => onNavigate('plan')}
          className="card flex w-full items-center gap-3.5 p-4 text-left transition hover:shadow-lift"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600">
            <Icon name="sparkles" size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold text-ink-900">What should I do today?</span>
            <span className="block truncate text-[12.5px] text-ink-500">
              {open.length
                ? `LifeLens can order your ${open.length} open ${open.length === 1 ? 'item' : 'items'} for you`
                : 'Scan something and LifeLens will plan your day'}
            </span>
          </span>
          <Icon name="chevronRight" size={18} className="shrink-0 text-ink-300" />
        </button>
      </section>

      {/* ------------------------------- next up ------------------------------- */}
      {nextUp.length > 0 && (
        <section className="px-5 pt-6">
          <SectionHeader title="Coming up" subtitle="The next things on your radar" />
          <div className="space-y-2.5">
            {nextUp.map((t) => (
              <TaskCard key={t.id} task={t} onOpen={() => setOpenTask(t)} compact />
            ))}
          </div>
        </section>
      )}

      {/* ---------------------------- recent captures -------------------------- */}
      <section className="px-5 pt-6">
        <SectionHeader title="Recent captures" subtitle="Your visual memory" action="See all" onAction={() => onNavigate('captures')} />
        <RecentCaptures onNavigate={onNavigate} />
      </section>

      <p className="px-5 pb-4 pt-8 text-center text-[11.5px] leading-relaxed text-ink-300">
        LifeLens doesn’t just tell you what it sees.
        <br />
        It tells you what you should do about it.
      </p>

      <TaskDetail task={openTask} onClose={() => setOpenTask(null)} />
    </div>
  );
}

function QuickAction({
  icon,
  label,
  tint,
  onClick,
}: {
  icon: 'camera' | 'upload' | 'mic' | 'tasks';
  label: string;
  tint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="card flex flex-col items-center gap-2 px-2 py-3.5 transition hover:shadow-lift active:scale-95"
    >
      <span className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${tint} text-white shadow-sm`}>
        <Icon name={icon} size={19} />
      </span>
      <span className="text-[11.5px] font-semibold text-ink-600">{label}</span>
    </button>
  );
}

function PriorityRow({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const meta = PRIORITY_META[task.priority];
  const d = daysUntil(task.dueDate ?? null);
  const overdue = d !== null && d < 0;

  return (
    <button onClick={onOpen} className="card relative block w-full overflow-hidden p-4 pl-5 text-left transition hover:shadow-lift">
      <span className={`absolute inset-y-0 left-0 w-1 ${meta.dot}`} aria-hidden />
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-ink-50 text-lg">
          {CATEGORY_EMOJI[task.category]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold text-ink-900">{task.title}</span>
          <span className={`mt-0.5 block text-[12.5px] font-semibold ${overdue ? 'text-rose-600' : 'text-ink-500'}`}>
            {dueCopy(task.dueDate, task.dueTime)}
          </span>
          {task.action && <span className="mt-1.5 block truncate text-[12px] text-ink-400">🎯 {task.action}</span>}
        </span>
        <PriorityBadge priority={task.priority} />
      </div>
    </button>
  );
}

function RecentCaptures({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { captures, deleteCapture } = useLifeLens();
  const recent = captures.slice(0, 3);

  if (recent.length === 0) {
    return (
      <EmptyState
        emoji="🗂️"
        title="No captures yet"
        body="Everything you scan is stored here so you can search your own life later."
        action="Scan something"
        onAction={() => onNavigate('capture')}
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {recent.map((c) => (
        <CaptureCard key={c.id} capture={c} onOpen={() => onNavigate('captures')} onDelete={() => void deleteCapture(c.id)} />
      ))}
    </div>
  );
}
