import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

export type ToastTone = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastCtx = createContext<{ push: (message: string, tone?: ToastTone) => void }>({ push: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback((message: string, tone: ToastTone = 'success') => {
    idRef.current += 1;
    const id = idRef.current;
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  const tones: Record<ToastTone, string> = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-rose-200 bg-rose-50 text-rose-700',
    info: 'border-brand-200 bg-brand-50 text-brand-800',
  };
  const icons = { success: 'check', error: 'alert', info: 'info' } as const;

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex max-w-[440px] items-start gap-2 rounded-2xl border px-4 py-3 text-[13px] font-medium shadow-lift animate-fade-up ${tones[t.tone]}`}
          >
            <span className="mt-[1px] shrink-0">
              <Icon name={icons[t.tone]} size={15} />
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
