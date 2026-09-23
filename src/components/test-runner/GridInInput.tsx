import { useId } from 'react';
import { MathInline } from '../math/MathInline';
import { answerTex } from '../../lib/scoring/answerDisplay';

interface GridInInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/** The SAT grid-in box holds 5 characters, or 6 when the first is a minus sign. */
const MAX_POSITIVE = 5;
const MAX_NEGATIVE = 6;

/**
 * Whether `next` is something the SAT answer box would let you enter: digits with at most
 * one decimal point and one fraction bar, and a minus sign only in front.
 */
export function acceptsGridIn(next: string): boolean {
  if (next === '' || next === '-') return true;
  if (!/^-?[0-9./]+$/.test(next)) return false;
  const negative = next.startsWith('-');
  const body = negative ? next.slice(1) : next;
  if ((body.match(/\//g) ?? []).length > 1 || (body.match(/\./g) ?? []).length > 1) return false;
  return next.length <= (negative ? MAX_NEGATIVE : MAX_POSITIVE);
}

type Key =
  | { kind: 'char'; char: string; label?: string }
  | { kind: 'sign' }
  | { kind: 'back' }
  | { kind: 'clear' };

/** Laid out like a calculator: 7-8-9 on top, the operators down the right-hand side. */
const KEYS: Key[] = [
  { kind: 'char', char: '7' },
  { kind: 'char', char: '8' },
  { kind: 'char', char: '9' },
  { kind: 'char', char: '/', label: 'Fraction bar' },
  { kind: 'char', char: '4' },
  { kind: 'char', char: '5' },
  { kind: 'char', char: '6' },
  { kind: 'char', char: '.', label: 'Decimal point' },
  { kind: 'char', char: '1' },
  { kind: 'char', char: '2' },
  { kind: 'char', char: '3' },
  { kind: 'sign' },
  { kind: 'clear' },
  { kind: 'char', char: '0' },
  { kind: 'back' },
];

/**
 * The fill-in answer box, with a keypad.
 *
 * A phone's number keyboard has no fraction bar and, on iOS, no minus sign — the two
 * characters grid-in answers need most. So the keypad carries every character an answer can
 * contain and the native keyboard is kept out of the way (`inputMode="none"`); a physical
 * keyboard still types straight into the box.
 *
 * Every edit, typed or tapped, goes through the same rule as the real answer box, so
 * nothing that couldn't be entered on the test can be entered here either.
 */
export function GridInInput({ value, onChange, disabled = false }: GridInInputProps) {
  const rulesId = useId();

  function propose(next: string) {
    if (!disabled && acceptsGridIn(next)) onChange(next);
  }

  function press(key: Key) {
    switch (key.kind) {
      case 'char':
        propose(value + key.char);
        break;
      case 'sign':
        // A toggle rather than a character, because the sign can only ever go in front.
        propose(value.startsWith('-') ? value.slice(1) : `-${value}`);
        break;
      case 'back':
        propose(value.slice(0, -1));
        break;
      case 'clear':
        propose('');
        break;
    }
  }

  const preview = value && value !== '-' ? answerTex(value) : '';

  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        inputMode="none"
        value={value}
        disabled={disabled}
        onChange={(e) => propose(e.target.value.replace(/−/g, '-'))}
        placeholder="Enter your answer"
        aria-label="Your answer"
        aria-describedby={rulesId}
        autoComplete="off"
        className="min-h-11 w-full border-2 border-ink bg-paper px-3 py-2.5 font-mono text-base tabular-nums text-ink placeholder:text-ink-soft disabled:bg-merino-dark disabled:text-ink-soft"
      />

      {/* What the test itself shows under the box: the answer as it will be read, so a
          fraction entered as 3/17 is visibly three-seventeenths, not "3", "/", "17". */}
      <p className="flex min-h-10 items-center gap-2 border-2 border-dashed border-ink-soft px-3 py-1.5 text-sm">
        <span className="text-[11px] font-semibold tracking-tight text-ink-soft uppercase">Answer preview</span>
        {preview ? (
          <span className="prose-reading text-lg">
            <MathInline tex={preview} />
          </span>
        ) : (
          <span className="text-ink-soft">—</span>
        )}
      </p>

      <div className="grid grid-cols-4 gap-[2px] border-2 border-ink bg-ink" role="group" aria-label="Answer keypad">
        {KEYS.map((key, index) => (
          <button
            key={index}
            type="button"
            disabled={disabled}
            onClick={() => press(key)}
            aria-label={
              key.kind === 'sign'
                ? 'Toggle negative'
                : key.kind === 'back'
                  ? 'Delete'
                  : key.kind === 'clear'
                    ? 'Clear'
                    : key.label
            }
            // Solid colours when disabled, not transparency: faded keys let the ink grid lines
            // behind them show through, and the whole pad turns a muddy grey.
            className={`min-h-12 font-mono text-lg font-bold active:translate-y-px disabled:cursor-not-allowed disabled:bg-merino disabled:text-ink-soft/40 ${
              key.kind === 'char' && /\d/.test(key.char)
                ? 'bg-paper text-ink hover:bg-merino-dark'
                : 'bg-merino-dark text-ink hover:bg-rock-blue'
            } ${key.kind === 'back' ? 'col-span-2' : ''}`}
          >
            {key.kind === 'char'
              ? key.char
              : key.kind === 'sign'
                ? '−'
                : key.kind === 'back'
                  ? '⌫'
                  : 'C'}
          </button>
        ))}
      </div>

      <p id={rulesId} className="text-xs text-ink-soft">
        Up to 5 characters, or 6 with a minus sign. Enter fractions like 3/17 and decimals like .75.
      </p>
    </div>
  );
}
