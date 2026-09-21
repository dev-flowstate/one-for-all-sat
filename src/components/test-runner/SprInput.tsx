import { Button } from '../ui/Button';

interface SprInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  submitted: boolean;
}

/** Student-produced-response text input with a submit button (Enter also submits). */
export function SprInput({ value, onChange, onSubmit, submitted }: SprInputProps) {
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-center"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <input
        type="text"
        value={value}
        disabled={submitted}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your answer"
        aria-label="Your answer"
        className="min-h-11 flex-1 border-2 border-ink bg-paper px-3 py-2.5 font-mono text-base tabular-nums text-ink placeholder:text-ink-soft disabled:bg-merino-dark disabled:text-ink-soft"
      />
      <Button type="submit" disabled={submitted || !value.trim()}>
        Submit
      </Button>
    </form>
  );
}
