import type { ChoiceId } from '../../types/question';

/** Normalizes a numeric answer string so equivalent forms compare equal (".75" vs "0.75"). */
function normalize(raw: string): string {
  let s = raw.trim().replace(/\s+/g, '').replace(/^\+/, '');
  if (s.startsWith('.')) s = '0' + s;
  if (s.startsWith('-.')) s = '-0' + s.slice(1);
  return s;
}

/** The number an answer stands for, or null when it isn't a plain number or fraction.
 *  Brackets are dropped, since the equation converter writes fractions as `(3)/(17)`. */
function valueOf(raw: string): number | null {
  const s = normalize(raw).replace(/[()]/g, '');
  const fraction = /^(-?\d*\.?\d+)\/(-?\d*\.?\d+)$/.exec(s);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator === 0 ? null : Number(fraction[1]) / denominator;
  }
  return /^-?\d*\.?\d+$/.test(s) ? Number(s) : null;
}

/**
 * Right when the answer is spelled like one of the accepted answers, or is the same number as
 * one: the SAT takes any equivalent fraction that fits the box, so 20/50 counts for 2/5. The
 * match is exact, not "close enough", so a decimal cut short (.67 for 2/3) stays wrong, as it
 * is on the test; the rounded and truncated spellings it does accept are among `acceptable`.
 */
export function checkSprAnswer(input: string, acceptable: string[]): boolean {
  if (!input.trim()) return false;
  const normalizedInput = normalize(input);
  if (acceptable.some((a) => normalize(a) === normalizedInput)) return true;
  const value = valueOf(input);
  if (value === null) return false;
  return acceptable.some((a) => {
    const target = valueOf(a);
    // Only floating-point noise is forgiven: 1/3 written as 2/6 differs in the last bits.
    return target !== null && Math.abs(value - target) <= 1e-9 * Math.max(1, Math.abs(target));
  });
}

export function checkMcqAnswer(selected: ChoiceId | undefined, correct: ChoiceId | undefined): boolean {
  return !!selected && selected === correct;
}
