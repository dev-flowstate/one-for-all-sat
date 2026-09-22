import type { Question } from '../../types/question';

/**
 * A fingerprint for "this is the same question", used when a shipped bank meets one a
 * student already imported by hand.
 *
 * Matching on id alone isn't enough: the two converters number their output differently
 * (`docx-eng-0001` is positional, `imported-ac472881` is a content hash), so the same
 * question can arrive under a different id and would otherwise be added twice — once
 * carrying the student's progress and once looking brand new.
 */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Below this the fingerprint isn't distinctive enough to merge on — see `isWeak`. */
const MIN_SIGNIFICANT_LENGTH = 40;

export function questionFingerprint(question: Question): string {
  const choices = (question.choices ?? []).map((c) => normalize(c.text)).join('|');
  const answers = (question.acceptableAnswers ?? []).map(normalize).join('|');
  return [
    normalize(question.prompt),
    normalize(question.explanation),
    choices,
    answers,
    question.correctChoice ?? '',
  ].join('\u0000');
}

/**
 * True when a fingerprint carries too little text to trust.
 *
 * Questions whose maths was typeset as vector graphics came through with placeholder text
 * and empty choices, so several hundred of them share almost identical strings. Merging on
 * that would collapse genuinely different questions into one; those fall back to matching
 * on id alone, where a duplicate is missed rather than invented.
 */
export function isWeakFingerprint(fingerprint: string): boolean {
  return fingerprint.replace(/\u0000/g, '').length < MIN_SIGNIFICANT_LENGTH;
}
