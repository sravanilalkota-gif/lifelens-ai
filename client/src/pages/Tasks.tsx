import { useMemo, useState } from 'react';
import type { Task } from '@lifelens/shared';
import { useLifeLens } from '../hooks/useLifeLens';
import { Icon } from '../components/Icon';
import { EmptyState, TaskCard } from '../components/Cards';
import { TaskDetail } from '../components/TaskDetail';
import { sortByUrgency } from '../lib/format';
import type { Page } from '../App';

type Filter = 'all' | 'open' | 'today' | 'done';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'today', label: 'Due soon' },
  { id: 'done', label: 'Done' },
];

export function TasksPage({ onNavigate, onAsk }: { onNavigate: (p: Page) => void; onAsk: () => void }) {
  const { tasks, toggleTask } = useLifeLens();
  const [filter, setFilter] = useState<Filter>('open');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Task | null>(null);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = tasks;
    if (filter === 'open') list = list.filter((t) => !t.done);
    if (filter === 'done') list = list.filter((t) => t.done);
    if (filter === 'today') list = list.filter((t) => !t.done && t.dueDate && daysLeft(t.dueDate) <= 3);
    if (needle) {
      list = list.filter((t) =>
        `${t.title} ${t.subject ?? ''} ${t.category} ${t.description ?? ''} ${t.action ?? ''}`.toLowerCase().includes(needle),
      );
    }
    return sortByUrgency(list);
  }, [tasks, filter, q]);

  const counts = useMemo(
    () => ({
      all: tasks.length,
      open: tasks.filter((t) => !t.done).length,
      today: tasks.filter((t) => !t.done && t.dueDate && daysLeft(t.dueDate) <= 3).length,
      done: tasks.filter((t) => t.done).length,
    }),
    [tasks],
  );

  return (
    <div className="animate-fade-in">
      <header className="flex items-start justify-between gap-3 px-5 pb-1 pt-7">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight text-ink-900">Tasks</h1>
          <p className="mt-1 text-[13px] text-ink-500">
            {counts.open} open • {counts.today} due in 3 days • {counts.done} done
          </p>
        </div>
        <button onClick={onAsk} className="btn-ghost px-3.5 py-2.5" aria-label="Ask LifeLens">
          <Icon name="mic" size={18} />
        </button>
      </header>

      <div className="sticky top-0 z-20 -mx-0 bg-ink-50/95 px-5 pb-3 pt-3 backdrop-blur">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300">
            <Icon name="search" size={17} />
          </span>
          <input
            className="input pl-10"
            placeholder="Search tasks — try “DBMS”"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search tasks"
          />
        </div>

        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-[12.5px] font-semibold transition ${
                filter === f.id
                  ? 'border-brand-600 bg-brand-600 text-white shadow-brand'
                  : 'border-ink-100 bg-white text-ink-500 hover:border-brand-200 hover:text-brand-700'
              }`}
            >
              {f.label}
              <span className="ml-1.5 text-[11px] opacity-70">{counts[f.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5 px-5 pt-1">
        {visible.length === 0 ? (
          <EmptyState
            emoji="✅"
            title={q ? 'Nothing matches that search' : 'No tasks here yet'}
            body={
              q
                ? 'Try a different word, or scan the notice again so LifeLens can remember it.'
                : 'Scan a notice or poster and LifeLens will create the tasks for you.'
            }
            action="Scan something"
            onAction={() => onNavigate('capture')}
          />
        ) : (
          visible.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onToggle={() => void toggleTask(t.id)}
              onOpen={() => setOpen(t)}
            />
          ))
        )}

        {visible.length > 0 && (
          <p className="pt-2 text-center text-[11.5px] text-ink-300">
            Sorted by deadline, then priority — LifeLens’ own ordering.
          </p>
        )}
      </div>

      <TaskDetail task={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function daysLeft(key: string): number {
  const target = new Date(`${key}T00:00:00`);
  const now = new Date();
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}


