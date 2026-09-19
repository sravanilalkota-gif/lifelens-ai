import { useEffect, type ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * Bottom sheet / modal used by the confirmation card, the voice assistant and
 * task details. Mobile-first: slides up on phones, centred dialog on desktop.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px] animate-fade-in"
      />
      <div
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-4xl bg-white shadow-lift animate-sheet-up
          sm:rounded-4xl ${size === 'lg' ? 'sm:max-w-[560px]' : 'sm:max-w-[440px]'}`}
      >
        {(title || subtitle) && (
          <header className="flex items-start justify-between gap-3 border-b border-ink-100 px-5 pb-3.5 pt-5">
            <div className="min-w-0">
              {title && <h3 className="truncate text-[17px] font-bold text-ink-900">{title}</h3>}
              {subtitle && <p className="mt-0.5 text-[12.5px] leading-snug text-ink-400">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-400 transition hover:bg-ink-100 hover:text-ink-800"
            >
              <Icon name="close" size={18} />
            </button>
          </header>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>

        {footer && <div className="safe-bottom border-t border-ink-100 bg-white px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}
