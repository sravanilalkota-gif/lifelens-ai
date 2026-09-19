import { useCallback, useEffect, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { ToastProvider } from './components/Toast';
import { VoiceAssistant } from './components/VoiceAssistant';
import { Icon } from './components/Icon';
import { useLifeLens } from './hooks/useLifeLens';
import { HomePage } from './pages/Home';
import { CapturePage } from './pages/Capture';
import { TasksPage } from './pages/Tasks';
import { PlanPage } from './pages/Plan';
import { CalendarPage } from './pages/Calendar';
import { CapturesPage } from './pages/Captures';
import { ProfilePage } from './pages/Profile';

export type Page = 'home' | 'capture' | 'tasks' | 'plan' | 'calendar' | 'captures' | 'profile';

export default function App() {
  const { error, dismissError, serverOnline, refresh } = useLifeLens();
  const [page, setPage] = useState<Page>('home');
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [captureSeed, setCaptureSeed] = useState(0);

  /** Deep-ish navigation helper passed to pages (quick actions, empty states). */
  const go = useCallback((p: Page) => {
    if (p === 'capture') setCaptureSeed((n) => n + 1);
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /** Keyboard shortcut: "v" opens the voice assistant — handy on stage. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /input|textarea/i.test(target.tagName)) return;
      if (e.key.toLowerCase() === 'v') setVoiceOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <ToastProvider>
      <div className="min-h-full bg-ink-50 pb-28">
        {/* offline / server banner */}
        {(error || !serverOnline) && (
          <div className="sticky top-0 z-30 border-b border-amber-200 bg-amber-50">
            <div className="app-shell flex items-start gap-2.5 px-4 py-3">
              <span className="mt-[1px] shrink-0 text-amber-600">
                <Icon name="wifiOff" size={17} />
              </span>
              <p className="flex-1 text-[12.5px] leading-relaxed text-amber-800">
                {error ?? 'LifeLens can’t reach its server.'}
              </p>
              <button
                onClick={() => {
                  dismissError();
                  void refresh();
                }}
                className="shrink-0 rounded-lg px-2 py-1 text-[12px] font-bold text-amber-700 transition hover:bg-amber-100"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        <main className="app-shell">
          {page === 'home' && <HomePage onNavigate={go} onAsk={() => setVoiceOpen(true)} />}
          {page === 'capture' && <CapturePage key={captureSeed} onNavigate={go} />}
          {page === 'tasks' && <TasksPage onNavigate={go} onAsk={() => setVoiceOpen(true)} />}
          {page === 'plan' && <PlanPage onNavigate={go} onAsk={() => setVoiceOpen(true)} />}
          {page === 'calendar' && <CalendarPage onNavigate={go} />}
          {page === 'captures' && <CapturesPage onNavigate={go} />}
          {page === 'profile' && <ProfilePage onNavigate={go} onAsk={() => setVoiceOpen(true)} />}
        </main>

        {/* floating voice button — always reachable */}
        <button
          onClick={() => setVoiceOpen(true)}
          aria-label="Ask LifeLens"
          className="fixed bottom-[86px] right-4 z-40 grid h-13 w-13 place-items-center rounded-full border border-ink-100 bg-white p-3 text-brand-700 shadow-lift transition hover:text-brand-800 active:scale-95 sm:right-[calc(50%-232px)]"
        >
          <Icon name="mic" size={22} />
        </button>

        <BottomNav page={page} onNavigate={go} />
        <VoiceAssistant open={voiceOpen} onClose={() => setVoiceOpen(false)} />
      </div>
    </ToastProvider>
  );
}
