import { useEffect } from 'react';
import { X, Moon, Sun, Check } from 'lucide-react';

export type Theme = 'dark' | 'light';

interface Props {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  postponeOnRed: boolean;
  onPostponeOnRedChange: (value: boolean) => void;
  postponeOnYellow: boolean;
  onPostponeOnYellowChange: (value: boolean) => void;
}

const THEMES: Array<{
  id: Theme;
  title: string;
  description: string;
  icon: typeof Moon;
  preview: string;
}> = [
  {
    id: 'dark',
    title: 'Темна',
    description: 'Класичний нічний вигляд',
    icon: Moon,
    preview: 'bg-[#0b0f19] border-[#1f2740]',
  },
  {
    id: 'light',
    title: 'Світла',
    description: 'Для денного використання',
    icon: Sun,
    preview: 'bg-[#f8fafc] border-[#e2e8f0]',
  },
];

export function SettingsModal({
  open,
  onClose,
  theme,
  onThemeChange,
  postponeOnRed,
  onPostponeOnRedChange,
  postponeOnYellow,
  onPostponeOnYellowChange,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Налаштування"
        className="w-full max-w-lg bg-ink-card border border-ink-border rounded-2xl p-6 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-fg">Налаштування</h2>
          <button
            onClick={onClose}
            aria-label="Закрити налаштування"
            className="text-muted-soft hover:text-fg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label className="text-sm text-fg-soft font-medium">Тема оформлення</label>
          <div className="grid grid-cols-2 gap-3 mt-3" role="radiogroup" aria-label="Тема оформлення">
            {THEMES.map(({ id, title, description, icon: Icon, preview }) => {
              const active = theme === id;
              return (
                <button
                  key={id}
                  role="radio"
                  aria-checked={active}
                  onClick={() => onThemeChange(id)}
                  className={`relative flex flex-col items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                    active
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-ink-border bg-ink hover:border-amber-500/40'
                  }`}
                >
                  {active && (
                    <span className="absolute top-3 right-3 flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-slate-900">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                  <span className={`flex items-center justify-center w-10 h-7 rounded-md border ${preview}`}>
                    <Icon className={`w-4 h-4 ${id === 'dark' ? 'text-amber-300' : 'text-amber-600'}`} />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-fg">{title}</span>
                    <span className="block text-xs text-muted-soft mt-0.5">{description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6">
          <label className="text-sm text-fg-soft font-medium">Будильники</label>
          <div className="mt-3 space-y-3">
            <div className="flex items-start justify-between gap-4 rounded-xl border border-ink-border bg-ink p-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-fg">
                  <span className="w-2 h-2 rounded-full bg-alert flex-shrink-0" />
                  Переносити під час червоної тривоги
                </p>
                <p className="text-xs text-muted-soft mt-1 leading-relaxed">
                  Якщо увімкнено, будильник не дзвонить під час червоної тривоги, а чекає відбою.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={postponeOnRed}
                aria-label="Переносити будильники під час червоної тривоги"
                onClick={() => onPostponeOnRedChange(!postponeOnRed)}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
                  postponeOnRed ? 'bg-amber-500' : 'bg-ink-border'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    postponeOnRed ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-xl border border-ink-border bg-ink p-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-fg">
                  <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                  Переносити під час жовтої тривоги
                </p>
                <p className="text-xs text-muted-soft mt-1 leading-relaxed">
                  Якщо увімкнено, будильник не дзвонить під час жовтої тривоги, а чекає відбою.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={postponeOnYellow}
                aria-label="Переносити будильники під час жовтої тривоги"
                onClick={() => onPostponeOnYellowChange(!postponeOnYellow)}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
                  postponeOnYellow ? 'bg-amber-500' : 'bg-ink-border'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    postponeOnYellow ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-soft mt-6 leading-relaxed text-center">
          Налаштування зберігаються лише у вашому браузері (localStorage).
        </p>
      </div>
    </div>
  );
}
