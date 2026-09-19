/**
 * The trust layer.
 *
 * LifeLens NEVER auto-saves what the AI produced. It shows the understanding,
 * flags the fields it was unsure about, lets the student correct anything, and
 * only then writes it to their tasks.
 */
import { useEffect, useState } from 'react';
import type { AnalysisResult, Category, Priority } from '@lifelens/shared';
import { CATEGORIES, CATEGORY_EMOJI, PRIORITIES, PRIORITY_META } from '@lifelens/shared';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { ConfidenceMeter } from './Badges';
import { formatDate, formatTime } from '../lib/format';
import { useLifeLens } from '../hooks/useLifeLens';

interface Props {
  open: boolean;
  result: AnalysisResult | null;
  imageData?: string | null;
  imageName?: string | null;
  fallbackNotice?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ConfirmCard({ open, result, imageData, imageName, fallbackNotice, onClose, onSaved }: Props) {
  const { saveCapture } = useLifeLens();
  const [draft, setDraft] = useState<AnalysisResult | null>(result);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // Re-sync the editable draft every time a fresh analysis arrives.
  useEffect(() => {
    if (result) {
      setDraft(result);
      setEditing(false);
      setTouched(false);
      setError(null);
    }
  }, [result]);

  if (!open || !draft) return null;

  const set = <K extends keyof AnalysisResult>(key: K, value: AnalysisResult[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setTouched(true);
  };

  const uncertain = new Set(draft.uncertainFields ?? []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveCapture({ result: draft, imageData, imageName, edited: touched });
      onSaved();
    } catch (e: any) {
      setError(e?.message ?? 'LifeLens could not save this. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? 'Edit what LifeLens understood' : 'LifeLens understood'}
      subtitle={
        draft.aiMode === 'gemini'
          ? 'Live vision analysis — check anything highlighted, then save.'
          : 'Demo Mode analysis — check anything highlighted, then save.'
      }
      footer={
        <div className="flex gap-2.5">
          <button className="btn-ghost flex-1" onClick={() => setEditing((v) => !v)}>
            <Icon name="edit" size={17} />
            {editing ? 'Preview' : 'Edit'}
          </button>
          <button className="btn-primary flex-[1.4]" onClick={save} disabled={saving}>
            {saving ? (
              <>
                <Spinner /> Saving…
              </>
            ) : (
              <>
                <Icon name="check" size={17} strokeWidth={2.4} /> Add to my tasks
              </>
            )}
          </button>
        </div>
      }
    >
      {/* thumbnail + confidence */}
      <div className="mb-4 flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-ink-100">
          {imageData ? (
            <img src={imageData} alt="Captured" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-to-br from-brand-100 to-brand-200 text-2xl">
              {CATEGORY_EMOJI[draft.category]}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <ConfidenceMeter value={draft.confidence} />
          <p className="mt-1 text-[11.5px] text-ink-400">
            {draft.aiMode === 'gemini' ? 'Gemini multimodal vision' : 'LifeLens built-in understanding engine'}
            {draft.demoKey ? ` • sample: ${draft.demoKey}` : ''}
          </p>
        </div>
      </div>

      {fallbackNotice && (
        <Notice tone="warn" title="LifeLens fell back to its built-in engine">
          {fallbackNotice}
        </Notice>
      )}
      {draft.note && !fallbackNotice && (
        <Notice tone="info" title="Note">
          {draft.note}
        </Notice>
      )}
      {error && (
        <Notice tone="error" title="Could not save">
          {error}
        </Notice>
      )}

      {!editing ? (
        <div className="space-y-2.5 animate-fade-up">
          <Row label="Title" emoji="📌">
            <span className="text-[16px] font-bold text-ink-900">{draft.title}</span>
          </Row>

          {draft.description && (
            <Row label="What it means" emoji="🧠">
              <span className="text-[13px] leading-relaxed text-ink-500">{draft.description}</span>
            </Row>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <Row label="Date" emoji="📅" flag={uncertain.has('date')} missing={!draft.date}>
              {draft.date ? formatDate(draft.date) : 'Not found'}
            </Row>
            <Row label="Time" emoji="🕑" flag={uncertain.has('time')} missing={!draft.time}>
              {draft.time ? formatTime(draft.time) : 'Not stated'}
            </Row>
            <Row label="Subject" emoji="📚" flag={uncertain.has('subject')} missing={!draft.subject}>
              {draft.subject ?? 'Not stated'}
            </Row>
            <Row label="Location" emoji="📍" flag={uncertain.has('location')} missing={!draft.location}>
              {draft.location ?? 'Not stated'}
            </Row>
          </div>

          <Row label="Category" emoji="🏷️">
            <span className="chip border-ink-100 bg-ink-50 text-ink-600">{draft.category}</span>
          </Row>

          <Row label="Priority" emoji={PRIORITY_META[draft.priority].emoji}>
            <span className={`chip ${PRIORITY_META[draft.priority].chip}`}>{draft.priority}</span>
            {draft.priorityReason && <p className="mt-1.5 text-[12px] leading-snug text-ink-400">{draft.priorityReason}</p>}
          </Row>

          <Row label="Reminder" emoji="⏰" missing={!draft.reminder}>
            {draft.reminder ? `${formatDate(draft.reminder)} — a heads-up before the date` : 'No reminder set'}
          </Row>

          {draft.action && (
            <div className="rounded-2xl border border-brand-100 bg-brand-50/70 p-3.5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-600">
                <Icon name="target" size={13} /> Suggested action
              </p>
              <p className="mt-1.5 text-[14px] font-semibold text-ink-900">{draft.action}</p>
            </div>
          )}

          {draft.tasks.length > 0 && (
            <div className="rounded-2xl border border-ink-100 bg-ink-50/60 p-3.5">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-400">
                <Icon name="list" size={13} /> LifeLens will create {draft.tasks.length} tasks
              </p>
              <ul className="space-y-1.5">
                {draft.tasks.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13.5px] text-ink-700">
                    <span className="mt-[3px] grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border border-ink-300 bg-white" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {draft.sourceText && (
            <details className="rounded-2xl border border-ink-100 bg-white p-3.5">
              <summary className="cursor-pointer text-[12.5px] font-semibold text-ink-500">
                Text LifeLens read from the image
              </summary>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-ink-400">
                {draft.sourceText}
              </pre>
            </details>
          )}
        </div>
      ) : (
        <div className="space-y-3.5 animate-fade-up">
          <Field label="Title">
            <input className="input" value={draft.title} onChange={(e) => set('title', e.target.value)} maxLength={90} />
          </Field>

          <Field label="Description">
            <textarea
              className="input min-h-[76px] resize-y"
              value={draft.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              maxLength={400}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input type="date" className="input" value={draft.date ?? ''} onChange={(e) => set('date', e.target.value || null)} />
            </Field>
            <Field label="Time">
              <input type="time" className="input" value={draft.time ?? ''} onChange={(e) => set('time', e.target.value || null)} />
            </Field>
            <Field label="Subject">
              <input
                className="input"
                value={draft.subject ?? ''}
                placeholder="e.g. DBMS"
                onChange={(e) => set('subject', e.target.value || null)}
                maxLength={60}
              />
            </Field>
            <Field label="Location">
              <input
                className="input"
                value={draft.location ?? ''}
                placeholder="e.g. Seminar Hall 2"
                onChange={(e) => set('location', e.target.value || null)}
                maxLength={80}
              />
            </Field>
          </div>

          <Field label="Category">
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
          </Field>

          <Field label="Priority (your call wins)">
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
          </Field>

          <Field label="Reminder date">
            <input
              type="date"
              className="input"
              value={draft.reminder ?? ''}
              onChange={(e) => set('reminder', e.target.value || null)}
            />
          </Field>

          <Field label="Suggested action">
            <input className="input" value={draft.action ?? ''} onChange={(e) => set('action', e.target.value || null)} maxLength={160} />
          </Field>

          <Field label={`Tasks LifeLens will create (${draft.tasks.length})`}>
            <div className="space-y-2">
              {draft.tasks.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="input py-2.5 text-[13.5px]"
                    value={t}
                    onChange={(e) => {
                      const next = [...draft.tasks];
                      next[i] = e.target.value;
                      set('tasks', next);
                    }}
                    maxLength={140}
                  />
                  <button
                    aria-label="Remove task"
                    onClick={() => set('tasks', draft.tasks.filter((_, idx) => idx !== i))}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-ink-300 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => set('tasks', [...draft.tasks, ''])}
                className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-[13px] font-semibold text-brand-600 transition hover:bg-brand-50"
              >
                <Icon name="plus" size={15} /> Add a task
              </button>
            </div>
          </Field>
        </div>
      )}
    </Sheet>
  );
}

function Row({
  label,
  emoji,
  children,
  flag,
  missing,
}: {
  label: string;
  emoji: string;
  children: React.ReactNode;
  flag?: boolean;
  missing?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3.5 ${
        flag ? 'border-amber-200 bg-amber-50/60' : missing ? 'border-dashed border-ink-100 bg-ink-50/40' : 'border-ink-100 bg-white'
      }`}
    >
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-400">
        <span aria-hidden>{emoji}</span> {label}
        {flag && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
            <Icon name="alert" size={11} /> check this
          </span>
        )}
      </p>
      <div className={missing ? 'text-ink-300' : 'text-ink-800'}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export function Notice({
  tone,
  title,
  children,
}: {
  tone: 'info' | 'warn' | 'error';
  title: string;
  children: React.ReactNode;
}) {
  const styles = {
    info: 'border-brand-100 bg-brand-50/60 text-brand-800',
    warn: 'border-amber-200 bg-amber-50 text-amber-800',
    error: 'border-rose-200 bg-rose-50 text-rose-700',
  }[tone];
  const icon = tone === 'error' ? 'alert' : tone === 'warn' ? 'alert' : 'info';
  return (
    <div className={`mb-4 flex gap-2.5 rounded-2xl border p-3.5 text-[12.5px] leading-relaxed ${styles}`}>
      <span className="mt-[1px] shrink-0">
        <Icon name={icon} size={15} />
      </span>
      <p>
        <span className="font-bold">{title}. </span>
        {children}
      </p>
    </div>
  );
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
