/**
 * Today's Plan — "What should I do today?"
 * LifeLens ranks everything the user has captured and produces a realistic,
 * ordered, time-slotted plan with a plain-language recommendation.
 */
import { useState } from 'react';
import type { PlanItem } from '@lifelens/shared';
import { CATEGORY_EMOJI, PRIORITY_META } from '@lifelens/shared';
import { useLifeLens } from '../hooks/useLifeLens';
import { Icon } from '../components/Icon';
import { EmptyState } from '../components/Cards';
import { Spinner } from '../components/ConfirmCard';
import { useToast } from '../components/Toast';
import type { Page } from '../App';

export function PlanPage({ onNavigate, onAsk }: { onNavigate: (p: Page) => void; onAsk: () => void }) {
  const { plan, loading, refresh, completePlanItem } = useLifeLens();
  const toast = useToast();
  const [building, setBuilding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function createPlan() {
    setBuilding(true);
    // small delay so the audience sees LifeLens "think" — it is a real recompute
    await new Promise((r) => setTimeout(r, 550));
    await refresh();
    setBuilding(false);
    toast.push('Plan updated from your latest captures.', 'success');
  }

  const counts = plan?.counts;

  return (
    <div className="animate-fade-in">
      <header className="relative overflow-hidden rounded-b-[2rem] gradient-brand px-5 pb-6 pt-7 text-white">
        <div className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full bg-white/10" aria-hidden />
        <div className="relative">
          <p className="text-[13px] font-medium text-white/75">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="mt-0.5 text-[25px] font-extrabold tracking-tight">What should I do today?</h1>
          <p className="mt-1.5 max-w-[22rem] text-[13px] leading-relaxed text-white/85">
            LifeLens looks at every deadline, exam and event you have captured and orders your day.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Stat label="High" value={counts?.high ?? 0} tone="bg-rose-400" />
            <Stat label="Medium" value={counts?.medium ?? 0} tone="bg-amber-300" />
            <Stat label="Low" value={counts?.low ?? 0} tone="bg-emerald-300" />
            <Stat label="Overdue" value={counts?.overdue ?? 0} tone="bg-white/70" />
          </div>

          <button
            onClick={() => void createPlan()}
            disabled={building}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-[15px] font-bold text-brand-700 shadow-lift transition active:scale-[0.98] disabled:opacity-80"
          >
            {building ? (
              <>
                <Spinner className="h-4 w-4" /> Building your plan…
              </>
            ) : (
              <>
                <Icon name="sparkles" size={18} /> Create my plan
              </>
            )}
          </button>
        </div>
      </header>

      <div className="px-5 pt-5">
        {loading && !plan ? (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-[96px]" />
            ))}
          </div>
        ) : !plan || plan.items.length === 0 ? (
          <EmptyState
            emoji="🗓️"
            title="Nothing needs your attention today"
            body={plan?.summary ?? 'Scan a notice and LifeLens will start planning your day around it.'}
            action="Scan something"
            onAction={() => onNavigate('capture')}
          />
        ) : (
          <>
            <div className="card card-pad mb-4 border-brand-100 bg-gradient-to-b from-brand-50/80 to-white">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-600">
                <Icon name="sparkles" size={13} /> LifeLens says
              </p>
              <p className="mt-1.5 text-[14.5px] font-semibold leading-relaxed text-ink-900">{plan.summary}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">{plan.recommendation}</p>
            </div>

            <ol className="space-y-3">
              {plan.items.map((item) => (
                <PlanRow
                  key={item.taskId ?? `${item.rank}-${item.title}`}
                  item={item}
                  busy={busyId === item.taskId}
                  onDone={async () => {
                    if (!item.taskId) return;
                    setBusyId(item.taskId);
                    await completePlanItem(item.taskId);
                    setBusyId(null);
                    toast.push(`Nice — “${item.title}” is done.`, 'success');
                  }}
                />
              ))}
            </ol>

            <div className="mt-5 flex gap-2.5">
              <button className="btn-ghost flex-1" onClick={() => onNavigate('tasks')}>
                <Icon name="tasks" size={17} /> All tasks
              </button>
              <button className="btn-primary flex-1" onClick={onAsk}>
                <Icon name="mic" size={17} /> Ask about my day
              </button>
            </div>
          </>
        )}

        <p className="py-8 text-center text-[11.5px] leading-relaxed text-ink-300">
          The plan is generated from your own captures — nothing is guessed.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11.5px] font-semibold backdrop-blur">
      <span className={`h-1.5 w-1.5 rounded-full ${tone}`} />
      {label} {value}
    </span>
  );
}

function PlanRow({ item, onDone, busy }: { item: PlanItem; onDone: () => void; busy: boolean }) {
  const meta = PRIORITY_META[item.priority];
  return (
    <li className="card relative overflow-hidden p-4 pl-5 animate-fade-up">
      <span className={`absolute inset-y-0 left-0 w-1 ${meta.dot}`} aria-hidden />
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-ink-900 text-[13px] font-bold text-white">
          {item.rank}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-ink-900">
            <span className="mr-1.5">{CATEGORY_EMOJI[item.category]}</span>
            {item.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-500">
            <span className="font-semibold text-ink-700">{item.dueLabel}</span>
            {item.timeSlot && (
              <span className="inline-flex items-center gap-1">
                <Icon name="clock" size={13} /> {item.timeSlot}
              </span>
            )}
            <span className={`chip ${meta.chip}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] leading-snug text-ink-400">{item.reason}</p>

          {item.subtasks && item.subtasks.length > 0 && (
            <ul className="mt-2.5 space-y-1">
              {item.subtasks.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-[12.5px] text-ink-600">
                  <span className="mt-[5px] h-3.5 w-3.5 shrink-0 rounded-[4px] border border-ink-300" aria-hidden />
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={onDone}
          disabled={busy}
          aria-label={`Mark ${item.title} as done`}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-ink-200 text-transparent transition hover:border-emerald-500 hover:text-emerald-500 disabled:opacity-50"
        >
          {busy ? <Spinner className="h-4 w-4 text-brand-600" /> : <Icon name="check" size={16} strokeWidth={2.6} />}
        </button>
      </div>
    </li>
  );
}
