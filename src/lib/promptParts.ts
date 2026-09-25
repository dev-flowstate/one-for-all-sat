import { splitSegments } from './math/segments';

export interface PromptParts {
  /** The text being asked about, or null when the prompt is only a question. */
  stimulus: string | null;
  /** The question itself — the sentence that actually asks something. */
  stem: string;
}

/** Below this, the leading text is too short to be a passage worth splitting out. */
const MIN_STIMULUS_LENGTH = 80;

/** A sentence end, but only where a new sentence plainly begins after it. The lookahead is
 *  what keeps "et al. is no longer applicable" (lowercase after the dot) from matching. A
 *  closing quote or bracket belongs to the sentence it closes (`"the Garden of Puerto Rico."`),
 *  and a text that ends on its blank (`It seems, then, that ______ Which choice…`) ends there. */
const SENTENCE_BOUNDARY = /(?:[.!?]["'”’)\]]*|_{3,})(?=\s+["'“‘(]?[A-Z])/g;

/** How the SAT's question sentences open. */
const QUESTION_OPENER = /(?:^|\s)(?=(?:Which|What|How|Based on|According to|As used in|Taken together)\b)/g;

/**
 * Separates a question's stimulus from the sentence that asks the question.
 *
 * Imported banks put both in one `prompt` field — the converters never tried to split them,
 * because doing it at parse time bakes a guess into the data. Doing it at render time keeps
 * the stored text untouched and lets the layout put the question next to the answers.
 *
 * Deliberately conservative: anything it isn't confident about comes back unsplit, which
 * renders exactly as it did before.
 */
export function splitPrompt(prompt: string): PromptParts {
  const text = prompt.trim();

  // The question sentence is last, so a prompt not ending in "?" has nothing to split on.
  if (!text.endsWith('?')) return { stimulus: null, stem: text };

  // A decimal point inside an equation or a table can look like a sentence end, and cutting
  // there would split one across the two panes, leaving each half unrenderable.
  const blocks = splitSegments(text).filter((s) => s.kind !== 'text');
  const insideMath = (index: number) => blocks.some((s) => index > s.start && index < s.end);

  // Where each sentence ends, just past its punctuation.
  const ends: number[] = [];
  SENTENCE_BOUNDARY.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SENTENCE_BOUNDARY.exec(text)) !== null) {
    if (!insideMath(match.index)) ends.push(match.index + match[0].length);
  }
  if (ends.length === 0) return { stimulus: null, stem: text };
  let cut = ends[ends.length - 1];

  // Text that runs into the question with no sentence end, like a poem line ending in a comma
  // or a "©2001 by Yann Martel" credit, belongs to the passage: cut again where the question
  // itself opens.
  const rest = text.slice(cut);
  if (!/^\s*(Which|What|How|Based on|According to|As used in|Taken together|The student wants)\b/.test(rest)) {
    let opener = -1;
    QUESTION_OPENER.lastIndex = 0;
    while ((match = QUESTION_OPENER.exec(rest)) !== null) {
      if (match.index > 0 && !insideMath(cut + match.index)) opener = match.index;
      QUESTION_OPENER.lastIndex = match.index + 1;
    }
    if (opener > 0) cut += opener;
  }

  // A notes question's goal sentence ("The student wants to emphasize …") is part of the
  // question it sets up, and sits with it, as on the test.
  const before = ends.filter((e) => e < cut).pop() ?? 0;
  if (text.slice(before, cut).trim().startsWith('The student wants')) cut = before;

  const stimulus = text.slice(0, cut).trim();
  const stem = text.slice(cut).trim();

  // A bare question ("If 6x - 9 = 21, what is the value of x?") has no stimulus to peel off,
  // and splitting it would leave the reading pane empty.
  if (!stem || stimulus.length < MIN_STIMULUS_LENGTH) return { stimulus: null, stem: text };

  return { stimulus, stem };
}
