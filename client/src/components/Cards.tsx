import { CATEGORY_EMOJI, PRIORITY_META, daysUntil } from '@lifelens/shared';
import type { Capture, Task } from '@lifelens/shared';
import { Icon } from './Icon';
import { CategoryChip, PriorityBadge } from './Badges';
import { dueCopy, relativeTime } from '../lib/format';

/* ------------------------------- task card -------------------------------- */

export function TaskCard({
  task,
  onToggle,
  onOpen,
  compact,
}: {
  task: Task;
  onToggle?: () => void;
  onOpen?: () => void;
  compact?: boolean;
}) {
  const meta = PRIORITY_META[task.priority];
  const overdue = (daysUntil(task.dueDate ?? null) ?? 1) < 0;
  const done = task.done;

  return (
    <div
      className={`card relative overflow-hidden transition hover:shadow-lift ${done ? 'opacity-60' : ''}`}
      onClick={onOpen}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={(e) => {
        if (onOpen && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${meta.dot}`} aria-hidden />
      <div className="flex items-start gap-3 p-4 pl-5">
        {onToggle && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            aria-label={done ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
            className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition
              ${done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-ink-300 text-transparent hover:border-brand-400'}`}
          >
            <Icon name="check" size={13} strokeWidth={3} />
          </button>
        )}

        <div className="min-w-0 flex-1">
          <p className={`truncate text-[15px] font-semibold text-ink-900 ${done ? 'line-through' : ''}`}>
            <span className="mr-1.5" aria-hidden>
              {CATEGORY_EMOJI[task.category]}
            </span>
            {task.title}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-500">
            <span className={overdue ? 'font-semibold text-rose-600' : ''}>{dueCopy(task.dueDate, task.dueTime)}</span>
            {task.location && (
              <span className="inline-flex items-center gap-1">
                <Icon name="pin" size={13} /> {task.location}
              </span>
            )}
            {task.subtasks?.length > 0 && (
              <span className="inline-flex items-center gap-1 text-ink-400">
                <Icon name="list" size={13} />
                {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
              </span>
            )}
          </div>

          {!compact && task.priorityReason && (
            <p className="mt-2 rounded-xl bg-ink-50 px-3 py-2 text-[12px] leading-snug text-ink-500">
              <span className="font-semibold text-ink-700">Why: </span>
              {task.priorityReason}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <PriorityBadge priority={task.priority} />
          {onOpen && <Icon name="chevronRight" size={16} className="text-ink-300" />}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ capture card ------------------------------ */

export function CaptureCard({
  capture,
  onOpen,
  onDelete,
}: {
  capture: Capture;
  onOpen?: () => void;
  onDelete?: () => void;
}) {
  const r = capture.result;
  return (
    <div className="card overflow-hidden transition hover:shadow-lift">
      <button className="block w-full text-left" onClick={onOpen} disabled={!onOpen}>
        <div className="flex gap-3 p-3.5">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-ink-100">
            {capture.imageData ? (
              <img src={capture.imageData} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-gradient-to-br from-brand-100 to-brand-200 text-2xl">
                <span aria-hidden>{CATEGORY_EMOJI[r.category]}</span>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-semibold text-ink-900">{r.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <CategoryChip category={r.category} />
              <PriorityBadge priority={r.priority} />
            </div>
            <p className="mt-1.5 text-[11.5px] text-ink-400">
              📷 {relativeTime(capture.createdAt)}
              {r.date ? ` • ${dueCopy(r.date)}` : ''}
            </p>
          </div>
        </div>
      </button>

      {onDelete && (
        <div className="flex justify-end border-t border-ink-100/70 px-3 py-2">
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold text-ink-400 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <Icon name="trash" size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ shared bits ------------------------------- */

export function SectionHeader({
  title,
  action,
  onAction,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-[17px] font-bold text-ink-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[12.5px] text-ink-400">{subtitle}</p>}
      </div>
      {action && (
        <button onClick={onAction} className="shrink-0 text-[13px] font-semibold text-brand-600 hover:text-brand-700">
          {action}
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  emoji = '🔍',
  title,
  body,
  action,
  onAction,
}: {
  emoji?: string;
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="card card-pad flex flex-col items-center py-10 text-center animate-fade-up">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-2xl">{emoji}</div>
      <p className="text-[15px] font-bold text-ink-900">{title}</p>
      <p className="mx-auto mt-1 max-w-[16rem] text-[13px] leading-relaxed text-ink-400">{body}</p>
      {action && (
        <button onClick={onAction} className="btn-primary mt-5 px-4 py-2.5 text-[14px]">
          {action}
        </button>
      )}
    </div>
  );
}
