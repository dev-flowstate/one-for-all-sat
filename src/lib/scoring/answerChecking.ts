import type { ChoiceId } from '../../types/question';

/** Normalizes a numeric answer string so equivalent forms compare equal (".75" vs "0.75"). */
function normalize(raw: string): string {
  let s = raw.trim().replace(/\s+/g, '').replace(/^\+/, '');
  if (s.startsWith('.')) s = '0' + s;
  if (s.startsWith('-.')) s = '-0' + s.slice(1);
  return s;
}

export function checkSprAnswer(input: string, acceptable: string[]): boolean {
  if (!input.trim()) return false;
  const normalizedInput = normalize(input);
  return acceptable.some((a) => normalize(a) === normalizedInput);
}

export function checkMcqAnswer(selected: ChoiceId | undefined, correct: ChoiceId | undefined): boolean {
  return !!selected && selected === correct;
}
