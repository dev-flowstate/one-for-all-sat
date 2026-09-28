import { THEMES, useTheme } from '../../lib/theme';
import { Card } from '../ui/Card';

/** Picks the site's look. Remembered on this device. */
export function ThemeCard() {
  const { theme, setTheme } = useTheme();

  return (
    <Card className="mb-4" title="Theme">
      <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
        {THEMES.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={theme === option.id}
            onClick={() => setTheme(option.id)}
            className={`press border-2 border-ink px-3 py-2.5 text-left ${
              theme === option.id ? 'bg-venice-blue text-merino' : 'bg-paper text-ink hover:bg-merino-dark'
            }`}
          >
            <span className="block font-mono text-sm font-bold tracking-tight uppercase">{option.label}</span>
            <span className="mt-0.5 block text-xs">{option.description}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}
