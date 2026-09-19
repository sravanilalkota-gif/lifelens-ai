import { Icon, type IconName } from './Icon';
import type { Page } from '../App';

const TABS: Array<{ page: Page; label: string; icon: IconName }> = [
  { page: 'home', label: 'Home', icon: 'home' },
  { page: 'tasks', label: 'Tasks', icon: 'tasks' },
  { page: 'capture', label: 'Scan', icon: 'camera' },
  { page: 'calendar', label: 'Calendar', icon: 'calendar' },
  { page: 'profile', label: 'Profile', icon: 'user' },
];

export function BottomNav({ page, onNavigate }: { page: Page; onNavigate: (p: Page) => void }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-100/80 bg-white/92 backdrop-blur-xl safe-bottom"
      aria-label="Main navigation"
    >
      <div className="app-shell flex items-end justify-between px-2 pb-1.5 pt-1.5">
        {TABS.map((tab) => {
          const isCapture = tab.page === 'capture';
          const active = page === tab.page;

          if (isCapture) {
            return (
              <button
                key={tab.page}
                onClick={() => onNavigate('capture')}
                aria-label="Scan something with LifeLens"
                className="relative -mt-7 flex flex-col items-center gap-1"
              >
                <span className="absolute -top-1 h-14 w-14 rounded-full bg-brand-500/25 animate-pulse-ring" aria-hidden />
                <span className="relative grid h-14 w-14 place-items-center rounded-full gradient-brand text-white shadow-brand ring-4 ring-white transition active:scale-95">
                  <Icon name="camera" size={24} strokeWidth={1.9} />
                </span>
                <span className="text-[10.5px] font-bold text-brand-700">{tab.label}</span>
              </button>
            );
          }

          return (
            <button
              key={tab.page}
              onClick={() => onNavigate(tab.page)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 transition ${
                active ? 'text-brand-700' : 'text-ink-300 hover:text-ink-500'
              }`}
            >
              <Icon name={tab.icon} size={22} strokeWidth={active ? 2.1 : 1.7} />
              <span className="text-[10.5px] font-semibold">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
