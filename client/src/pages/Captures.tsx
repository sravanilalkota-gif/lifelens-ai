/**
 * My Captures + memory search.
 * "Show me everything related to DBMS" → every exam, assignment, timetable and
 * task LifeLens has ever extracted about that topic.
 */
import { useMemo, useState } from 'react';
import type { Capture } from '@lifelens/shared';
import { CATEGORY_EMOJI, PRIORITY_META } from '@lifelens/shared';
import { useLifeLens } from '../hooks/useLifeLens';
import { Icon } from '../components/Icon';
import { CaptureCard, EmptyState } from '../components/Cards';
import { ConfidenceMeter } from '../components/Badges';
import { Sheet } from '../components/Sheet';
import { formatDate, formatTime, relativeTime } from '../lib/format';
import type { Page } from '../App';
import type { MemoryResponse } from '../lib/api';

export function CapturesPage({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { captures, deleteCapture, searchMemory, loading } = useLifeLens();
  const [q, setQ] = useState('');
  const [memory, setMemory] = useState<MemoryResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [openCapture, setOpenCapture] = useState<Capture | null>(null);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return captures;
    return captures.filter((c) =>
      `${c.result.title} ${c.result.subject ?? ''} ${c.result.description ?? ''} ${c.result.category} ${c.result.sourceText ?? ''}`
        .toLowerCase()
        .includes(needle),
    );
  }, [captures, q]);

  async function runMemorySearch() {
    const term = q.trim();
    if (!term) {
      setMemory(null);
      return;
    }
    setSearching(true);
    try {
      setMemory(await searchMemory(term));
    } catch {
      setMemory(null);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <header className="px-5 pb-1 pt-7">
        <h1 className="text-[24px] font-extrabold tracking-tight text-ink-900">My captures</h1>
        <p className="mt-1 text-[13px] text-ink-500">
          {captures.length} item{captures.length === 1 ? '' : 's'} in your visual memory
        </p>
      </header>

      <div className="sticky top-0 z-20 bg-ink-50/95 px-5 pb-3 pt-3 backdrop-blur">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runMemorySearch();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300">
              <Icon name="search" size={17} />
            </span>
            <input
              className="input pl-10"
              placeholder="Search memory — “DBMS”, “fee”, “workshop”…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                if (!e.target.value.trim()) setMemory(null);
              }}
              aria-label="Search captures"
            />
          </div>
          <button type="submit" className="btn-primary shrink-0 px-4" aria-label="Search">
            {searching ? '…' : <Icon name="search" size={18} />}
          </button>
        </form>
      </div>

      <div className="px-5">
        {memory && q.trim() && (
          <div className="card card-pad mb-4 border-brand-100 bg-gradient-to-b from-brand-50/70 to-white animate-fade-up">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-600">
              <Icon name="brain" size={13} /> LifeLens memory
            </p>
            <p className="mt-1.5 text-[14px] font-semibold leading-relaxed text-ink-900">{memory.answer}</p>

            {memory.grouped.length > 0 && (
              <ul className="mt-3 space-y-2">
                {memory.grouped.slice(0, 5).map((g) => (
                  <li key={g.subject} className="flex items-start gap-2.5 rounded-2xl bg-white/70 p-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-ink-50 text-[14px]">
                      {emojiForGroup(memory, g.subject)}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-bold text-ink-900">
                        {g.subject} <span className="font-medium text-ink-400">· {g.count}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-ink-500">{g.titles.join(' • ')}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {loading && visible.length === 0 ? (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-[92px]" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            emoji={q ? '🔍' : '🗂️'}
            title={q ? 'Nothing matches that search' : 'No captures yet'}
            body={
              q
                ? 'LifeLens has not seen anything about that yet. Scan it and it will remember it forever.'
                : 'Everything you scan lives here — searchable forever, like a memory layer for your physical world.'
            }
            action="Scan something"
            onAction={() => onNavigate('capture')}
          />
        ) : (
          <div className="space-y-2.5">
            {visible.map((c) => (
              <CaptureCard key={c.id} capture={c} onOpen={() => setOpenCapture(c)} onDelete={() => void deleteCapture(c.id)} />
            ))}
          </div>
        )}
      </div>

      <div className="h-6" />

      <Sheet
        open={Boolean(openCapture)}
        onClose={() => setOpenCapture(null)}
        size="lg"
        title={openCapture?.result.title ?? ''}
        subtitle={
          openCapture
            ? `${openCapture.result.category}${openCapture.result.subject ? ` • ${openCapture.result.subject}` : ''} • captured ${relativeTime(openCapture.createdAt)}`
            : undefined
        }
      >
        {openCapture && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl bg-ink-100">
              {openCapture.imageData ? (
                <img src={openCapture.imageData} alt="Captured" className="max-h-[240px] w-full object-contain" />
              ) : (
                <div className="grid h-32 place-items-center bg-gradient-to-br from-brand-100 to-brand-200 text-4xl">
                  {CATEGORY_EMOJI[openCapture.result.category]}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className={`chip ${PRIORITY_META[openCapture.result.priority].chip}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_META[openCapture.result.priority].dot}`} />
                {PRIORITY_META[openCapture.result.priority].label} priority
              </span>
              <ConfidenceMeter value={openCapture.result.confidence} />
            </div>

            {openCapture.result.description && (
              <p className="text-[13.5px] leading-relaxed text-ink-600">{openCapture.result.description}</p>
            )}

            <dl className="grid grid-cols-2 gap-2.5">
              <Detail label="📅 Date" value={openCapture.result.date ? formatDate(openCapture.result.date) : 'Not found'} />
              <Detail label="🕑 Time" value={formatTime(openCapture.result.time) ?? 'Not stated'} />
              <Detail label="📍 Location" value={openCapture.result.location ?? 'Not stated'} />
              <Detail label="⏰ Reminder" value={openCapture.result.reminder ? formatDate(openCapture.result.reminder) : 'None'} />
            </dl>

            {openCapture.result.priorityReason && (
              <div className="rounded-2xl border border-ink-100 bg-ink-50/70 p-3.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-400">Why this priority</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-600">{openCapture.result.priorityReason}</p>
              </div>
            )}

            {openCapture.result.action && (
              <div className="rounded-2xl border border-brand-100 bg-brand-50/70 p-3.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-600">Suggested action</p>
                <p className="mt-1 text-[13.5px] font-semibold text-ink-900">{openCapture.result.action}</p>
              </div>
            )}

            {openCapture.result.tasks.length > 0 && (
              <div>
                <p className="label">Tasks created from this capture</p>
                <ul className="space-y-1.5">
                  {openCapture.result.tasks.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13.5px] text-ink-700">
                      <span className="mt-[3px] grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border border-ink-300" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {openCapture.result.sourceText && (
              <details className="rounded-2xl border border-ink-100 bg-white p-3.5">
                <summary className="cursor-pointer text-[12.5px] font-semibold text-ink-500">Text read from the image</summary>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-ink-400">
                  {openCapture.result.sourceText}
                </pre>
              </details>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-3">
      <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-400">{label}</dt>
      <dd className="mt-1 text-[13.5px] font-semibold text-ink-800">{value}</dd>
    </div>
  );
}

/** Pick an emoji for a memory group by looking at what it actually matched. */
function emojiForGroup(memory: MemoryResponse, subject: string): string {
  const needle = subject.toLowerCase();
  const hit =
    memory.captures.find(
      (c) =>
        (c.result.subject ?? '').toLowerCase() === needle || c.result.category.toLowerCase() === needle,
    ) ?? memory.captures[0];
  if (!hit) return '📌';
  return CATEGORY_EMOJI[hit.result.category] ?? '📌';
}
