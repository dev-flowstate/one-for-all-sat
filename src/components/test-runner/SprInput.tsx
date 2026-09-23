import { Button } from '../ui/Button';
import { GridInInput } from './GridInInput';

interface SprInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  submitted: boolean;
}

/** Student-produced-response answer box with its keypad; Enter also submits. */
export function SprInput({ value, onChange, onSubmit, submitted }: SprInputProps) {
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <GridInInput value={value} onChange={onChange} disabled={submitted} />
      <Button type="submit" className="w-full" disabled={submitted || !value.trim() || value === '-'}>
        Submit
      </Button>
    </form>
  );
}
