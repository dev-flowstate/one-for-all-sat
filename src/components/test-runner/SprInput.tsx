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
        className="min-h-11 flex-1 rounded-lg border border-rock-blue/50 bg-white/80 px-4 py-2.5 text-sm text-venice-blue-dark placeholder:text-venice-blue-dark/40 focus:border-venice-blue focus:outline-none disabled:opacity-60"
      />
      <Button type="submit" disabled={submitted || !value.trim()}>
        Submit
      </Button>
    </form>
  );
}
