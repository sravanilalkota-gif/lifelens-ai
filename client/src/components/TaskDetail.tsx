/**
 * Task detail sheet — edit anything LifeLens created, tick off sub-steps,
 * or delete the task. This is where "edit AI results" lives after saving.
 */
import { useEffect, useState } from 'react';
import type { Category, Priority, Task } from '@lifelens/shared';
import { CATEGORIES, CATEGORY_EMOJI, PRIORITIES, PRIORITY_META } from '@lifelens/shared';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { useLifeLens } from '../hooks/useLifeLens';
import { dueCopy } from '../lib/format';

export function TaskDetail({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { patchTask, deleteTask } = useLifeLens();
  const [draft, setDraft] = useState<Task | null>(task);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(task), [task]);
  if (!task || !draft) return null;

  const set = <K extends keyof Task>(key: K, value: Task[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  const persist = async (patch: Partial<Task>) => {
    setSaving(true);
    try {
      await patchTask(task.id, patch);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={Boolean(task)}
      onClose={onClose}
      size="lg"
      title={task.title}
      subtitle={`${task.category}${task.subject ? ` • ${task.subject}` : ''} • ${dueCopy(task.dueDate, task.dueTime)}`}
      footer={
        <div className="flex gap-2.5">
          <button
            className="btn-ghost flex-1 text-rose-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
            onClick={async () => {
              await deleteTask(task.id);
              onClose();
            }}
          >
            <Icon name="trash" size={17} /> Delete
          </button>
          <button
            className="btn-primary flex-[1.4]"
            disabled={saving}
            onClick={async () => {
              await persist({
                title: draft.title,
                category: draft.category,
                priority: draft.priority,
                dueDate: draft.dueDate ?? null,
                dueTime: draft.dueTime ?? null,
                location: draft.location ?? null,
                reminder: draft.reminder ?? null,
                subtasks: draft.subtasks,
              });
              onClose();
            }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      }
    >
      {task.priorityReason && (
        <div className="mb-4 rounded-2xl border border-brand-100 bg-brand-50/60 p-3.5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-600">
            <Icon name="brain" size={13} /> Why this priority
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-700">{task.priorityReason}</p>
        </div>
      )}

      {task.action && (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-ink-100 bg-ink-50/70 p-3.5">
          <span className="mt-[2px] text-brand-600">
            <Icon name="target" size={16} />
          </span>
          <p className="text-[13.5px] font-medium text-ink-700">{task.action}</p>
        </div>
      )}

      <div className="mb-4">
        <p className="label">Checklist LifeLens created</p>
        <div className="space-y-2">
          {draft.subtasks.length === 0 && <p className="text-[13px] text-ink-300">No steps yet — add one below.</p>}
          {draft.subtasks.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2.5 rounded-2xl border border-ink-100 bg-white px-3 py-2.5">
              <button
                onClick={() => {
                  const next = draft.subtasks.map((x, idx) => (idx === i ? { ...x, done: !x.done } : x));
                  set('subtasks', next);
                }}
                aria-label={s.done ? 'Mark as not done' : 'Mark as done'}
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition ${
                  s.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-ink-300 text-transparent'
                }`}
              >
                <Icon name="check" size={11} strokeWidth={3.5} />
              </button>
              <input
                value={s.title}
                onChange={(e) => {
                  const next = draft.subtasks.map((x, idx) => (idx === i ? { ...x, title: e.target.value } : x));
                  set('subtasks', next);
                }}
                className={`min-w-0 flex-1 bg-transparent text-[13.5px] outline-none ${s.done ? 'text-ink-300 line-through' : 'text-ink-800'}`}
              />
              <button
                aria-label="Remove step"
                onClick={() => set('subtasks', draft.subtasks.filter((_, idx) => idx !== i))}
                className="text-ink-300 transition hover:text-rose-500"
              >
                <Icon name="close" size={15} />
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              set('subtasks', [...draft.subtasks, { id: `st_${Math.random().toString(36).slice(2, 8)}`, title: '', done: false }])
            }
            className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-[13px] font-semibold text-brand-600 transition hover:bg-brand-50"
          >
            <Icon name="plus" size={15} /> Add a step
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Due date</label>
          <input
            type="date"
            className="input"
            value={draft.dueDate ?? ''}
            onChange={(e) => set('dueDate', e.target.value || null)}
          />
        </div>
        <div>
          <label className="label">Due time</label>
          <input type="time" className="input" value={draft.dueTime ?? ''} onChange={(e) => set('dueTime', e.target.value || null)} />
        </div>
        <div>
          <label className="label">Reminder</label>
          <input
            type="date"
            className="input"
            value={draft.reminder ?? ''}
            onChange={(e) => set('reminder', e.target.value || null)}
          />
        </div>
        <div>
          <label className="label">Location</label>
          <input
            className="input"
            value={draft.location ?? ''}
            onChange={(e) => set('location', e.target.value || null)}
            placeholder="Not set"
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="label">Category</label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c: Category) => (
            <button
              key={c}
              onClick={() => set('category', c)}
              className={`chip transition ${
                draft.category === c ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-ink-100 bg-ink-50 text-ink-500'
              }`}
            >
              {CATEGORY_EMOJI[c]} {c}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <label className="label">Priority</label>
        <div className="grid grid-cols-3 gap-2">
          {PRIORITIES.map((p: Priority) => (
            <button
              key={p}
              onClick={() => set('priority', p)}
              className={`rounded-2xl border px-3 py-2.5 text-[13px] font-semibold transition ${
                draft.priority === p ? PRIORITY_META[p].chip : 'border-ink-100 bg-ink-50 text-ink-500'
              }`}
            >
              {PRIORITY_META[p].emoji} {p}
            </button>
          ))}
        </div>
      </div>

      <button
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[14px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
        onClick={async () => {
          await persist({ done: !task.done });
          onClose();
        }}
      >
        <Icon name="check" size={17} /> {task.done ? 'Mark as not done' : 'Mark task as complete'}
      </button>
    </Sheet>
  );
}
