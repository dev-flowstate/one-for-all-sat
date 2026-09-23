/**
 * Turning a grid-in's accepted answers into something to show a student.
 *
 * `acceptableAnswers` lists every spelling that should be marked right — `3/17`, `0.1765`
 * and `0.1764` are all the same answer, entered three ways. Listed raw, the "correct
 * answer" line reads as four answers. But some questions genuinely have several (`0 or 3`),
 * so spellings are grouped by the number they stand for and one is kept per number.
 */

/** Unwraps `(3)/(17)`, the shape fractions come out of the equation converter in. */
function unwrap(answer: string): string {
  return answer.replace(/\((-?[\d.]+)\)/g, '$1').replace(/\s+/g, '');
}

function valueOf(answer: string): number | null {
  const fraction = /^(-?\d*\.?\d+)\/(\d*\.?\d+)$/.exec(answer);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator ? Number(fraction[1]) / denominator : null;
  }
  const n = Number(answer);
  return answer !== '' && Number.isFinite(n) ? n : null;
}

/** Whole numbers read cleanest, then fractions, then the decimals a fraction was rounded to. */
function rank(answer: string): number {
  if (/^-?\d+$/.test(answer)) return 0;
  if (/^-?\d+\/\d+$/.test(answer)) return 1;
  return 2;
}

/** A rounded or truncated decimal only differs from its fraction in the fourth place. */
const SAME_VALUE = 0.001;

export function distinctAnswers(acceptable: readonly string[]): string[] {
  const groups: { value: number | null; text: string }[] = [];
  for (const raw of acceptable) {
    const text = unwrap(raw);
    const value = valueOf(text);
    const match = groups.find(
      (g) => value !== null && g.value !== null && Math.abs(g.value - value) < SAME_VALUE,
    );
    if (!match) groups.push({ value, text });
    else if (rank(text) < rank(match.text)) match.text = text;
  }
  return groups.map((g) => g.text);
}

/** A typed fraction as TeX, so it can be drawn stacked: `-3/17` → `-\frac{3}{17}`. */
export function answerTex(answer: string): string {
  const fraction = /^(-?)(\d*\.?\d+)\/(\d*\.?\d+)$/.exec(answer.trim());
  return fraction ? `${fraction[1]}\\frac{${fraction[2]}}{${fraction[3]}}` : answer.trim();
}
