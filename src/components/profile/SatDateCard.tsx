import { useSettingsStore } from '../../store/useSettingsStore';
import { SAT_DATES, satStart } from '../../data/satDates';
import { Card } from '../ui/Card';

/** Changes the SAT date the home screen counts down to. */
export function SatDateCard() {
  const satDate = useSettingsStore((s) => s.profile?.satDate);
  const setSatDate = useSettingsStore((s) => s.setSatDate);
  const now = new Date();

  return (
    <Card className="mb-4" title="SAT date">
      <p className="mb-3 text-sm text-ink-soft">The home screen counts down to it.</p>
      <div className="grid gap-3 sm:grid-cols-4" role="radiogroup" aria-label="SAT date">
        {[...SAT_DATES.map((d) => ({ value: d.date as string | undefined, label: d.label })), { value: undefined, label: 'Not set' }].map(
          (option) => {
            const past = option.value !== undefined && satStart(option.value) <= now;
            return (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={satDate === option.value}
                disabled={past}
                onClick={() => setSatDate(option.value)}
                className={`press min-h-11 border-2 border-ink px-3 py-2 font-mono text-sm font-semibold tracking-tight uppercase disabled:cursor-not-allowed disabled:opacity-40 ${
                  satDate === option.value ? 'bg-venice-blue text-merino' : 'bg-paper text-ink hover:bg-merino-dark'
                }`}
              >
                {option.label}
              </button>
            );
          },
        )}
      </div>
    </Card>
  );
}
