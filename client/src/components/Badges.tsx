import type { Category, Priority } from '@lifelens/shared';
import { CATEGORY_EMOJI, PRIORITY_META } from '@lifelens/shared';
import { Icon } from './Icon';

export function PriorityBadge({ priority, size = 'sm' }: { priority: Priority; size?: 'sm' | 'md' }) {
  const meta = PRIORITY_META[priority];
  return (
    <span
      className={`chip ${meta.chip} ${size === 'md' ? 'px-3 py-1.5 text-xs' : ''}`}
      title={`${meta.label} priority`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export function CategoryChip({ category }: { category: Category }) {
  return (
    <span className="chip border-ink-100 bg-ink-50 text-ink-500">
      <span aria-hidden>{CATEGORY_EMOJI[category] ?? '📌'}</span>
      {category}
    </span>
  );
}

export function MetaLine({
  icon,
  children,
  muted,
}: {
  icon: 'calendar' | 'clock' | 'pin' | 'bell' | 'target' | 'brain' | 'book';
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className={`flex items-start gap-2 text-[13px] ${muted ? 'text-ink-300' : 'text-ink-500'}`}>
      <span className={`mt-[1px] shrink-0 ${muted ? 'text-ink-300' : 'text-ink-400'}`}>
        <Icon name={icon} size={15} />
      </span>
      <span className="leading-snug">{children}</span>
    </div>
  );
}

export function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const tone = pct >= 80 ? 'bg-emerald-500' : pct >= 55 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-100">
        <div className={`h-full rounded-full ${tone} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-semibold text-ink-400">{pct}% confident</span>
    </div>
  );
}
