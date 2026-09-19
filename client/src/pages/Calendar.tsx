/**
 * Calendar & deadlines — a clean month grid plus a day-by-day agenda.
 * Visual clarity beats calendar complexity here.
 */
import { useMemo, useState } from 'react';
import type { Task } from '@lifelens/shared';
import { CATEGORY_EMOJI, PRIORITY_META, localDateKey } from '@lifelens/shared';
import { useLifeLens } from '../hooks/useLifeLens';
import { Icon } from '../components/Icon';
import { EmptyState } from '../components/Cards';
import { TaskDetail } from '../components/TaskDetail';
import { formatDateLong } from '../lib/format';
import type { Page } from '../App';

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function CalendarPage({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { tasks } = useLifeLens();
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string>(localDateKey(today));
  const [open, setOpen] = useState<Task | null>(null);

  const dated = useMemo(() => tasks.filter((t) => t.dueDate), [tasks]);

  const byDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of dated) {
      const key = t.dueDate as string;
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return map;
  }, [dated]);

  const grid = useMemo(() => buildMonthGrid(month), [month]);
  const agenda = useMemo(() => {
    const upcoming = dated
      .filter((t) => (t.dueDate as string) >= localDateKey(today))
      .sort((a, b) => (a.dueDate as string).localeCompare(b.dueDate as string));
    const selectedItems = byDate.get(selected) ?? [];
    return { upcoming, selectedItems };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dated, byDate, selected]);

  const monthLabel = month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="animate-fade-in">
      <header className="px-5 pb-1 pt-7">
        <h1 className="text-[24px] font-extrabold tracking-tight text-ink-900">Calendar</h1>
        <p className="mt-1 text-[13px] text-ink-500">Every exam, deadline and event LifeLens has captured</p>
      </header>

      {/* month grid */}
      <section className="px-5 pt-4">
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <button
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              className="grid h-9 w-9 place-items-center rounded-xl text-ink-500 transition hover:bg-ink-100"
              aria-label="Previous month"
            >
              <Icon name="chevronLeft" size={17} />
            </button>
            <p className="text-[15px] font-bold text-ink-900">{monthLabel}</p>
            <button
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              className="grid h-9 w-9 place-items-center rounded-xl text-ink-500 transition hover:bg-ink-100"
              aria-label="Next month"
            >
              <Icon name="chevronRight" size={17} />
            </button>
          </div>

          <div className="mb-1.5 grid grid-cols-7 gap-1">
            {WEEK.map((d) => (
              <span key={d} className="text-center text-[10.5px] font-bold uppercase tracking-wide text-ink-300">
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {grid.map((cell) => {
              if (!cell) return <span key={`e${Math.random()}`} />;
              const key = localDateKey(cell.date);
              const items = byDate.get(key) ?? [];
              const isToday = key === localDateKey(today);
              const isSelected = key === selected;
              const top = items[0];
              return (
                <button
                  key={key}
                  onClick={() => setSelected(key)}
                  className={`relative flex h-11 flex-col items-center justify-center rounded-xl text-[12.5px] font-semibold transition
                    ${isSelected ? 'bg-brand-600 text-white shadow-brand' : isToday ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-50'}`}
                >
                  {cell.date.getDate()}
                  <span className="mt-0.5 flex gap-[2px]">
                    {items.slice(0, 3).map((t) => (
                      <span
                        key={t.id}
                        className={`h-1 w-1 rounded-full ${isSelected ? 'bg-white' : PRIORITY_META[t.priority].dot}`}
                        aria-hidden
                      />
                    ))}
                  </span>
                  {top && <span className="sr-only">{top.title}</span>}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-ink-100 pt-3 text-[10.5px] font-semibold text-ink-400">
            {(['HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
              <span key={p} className="inline-flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_META[p].dot}`} /> {PRIORITY_META[p].label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* selected day */}
      <section className="px-5 pt-5">
        <div className="mb-2.5 flex items-center gap-2">
          <h2 className="text-[16px] font-bold text-ink-900">{formatDateLong(selected)}</h2>
          {selected === localDateKey(today) && (
            <span className="chip border-brand-200 bg-brand-50 text-brand-700">Today</span>
          )}
        </div>

        {agenda.selectedItems.length === 0 ? (
          <p className="card card-pad text-[13px] text-ink-400">Nothing captured for this day.</p>
        ) : (
          <div className="space-y-2.5">
            {agenda.selectedItems.map((t) => (
              <DayItem key={t.id} task={t} onOpen={() => setOpen(t)} />
            ))}
          </div>
        )}
      </section>

      {/* upcoming timeline */}
      <section className="px-5 pt-6">
        <h2 className="mb-3 text-[16px] font-bold text-ink-900">Upcoming deadlines</h2>
        {agenda.upcoming.length === 0 ? (
          <EmptyState
            emoji="🗓️"
            title="No upcoming deadlines"
            body="Scan a notice, poster or assignment sheet and it will show up here automatically."
            action="Scan something"
            onAction={() => onNavigate('capture')}
          />
        ) : (
          <ol className="relative space-y-3 border-l-2 border-ink-100 pl-5">
            {agenda.upcoming.slice(0, 12).map((t) => (
              <li key={t.id} className="relative">
                <span
                  className={`absolute -left-[27px] top-4 h-3 w-3 rounded-full ring-4 ring-ink-50 ${PRIORITY_META[t.priority].dot}`}
                  aria-hidden
                />
                <DayItem task={t} onOpen={() => setOpen(t)} />
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="h-6" />
      <TaskDetail task={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function DayItem({ task, onOpen }: { task: Task; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="card block w-full p-3.5 text-left transition hover:shadow-lift">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-50 text-[16px]">
          {CATEGORY_EMOJI[task.category]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold text-ink-900">{task.title}</span>
          <span className="mt-0.5 block text-[12px] text-ink-500">
            {task.subject ? `${task.subject} • ` : ''}
            {task.dueTime ? formatTime(task.dueTime) : 'All day'}
            {task.location ? ` • ${task.location}` : ''}
          </span>
        </span>
        <span className={`chip shrink-0 ${PRIORITY_META[task.priority].chip}`}>{PRIORITY_META[task.priority].label}</span>
      </div>
    </button>
  );
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Monday-first month grid. */
function buildMonthGrid(month: Date): Array<{ date: Date } | null> {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<{ date: Date } | null> = [];
  for (let i = 0; i < offset; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push({ date: new Date(month.getFullYear(), month.getMonth(), d) });
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
