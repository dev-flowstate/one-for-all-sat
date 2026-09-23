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
 *  what keeps "et al. is no longer applicable" (lowercase after the dot) from matching. */
const SENTENCE_BOUNDARY = /[.!?](?=\s+["'“(]?[A-Z])/g;

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

  let lastBoundary = -1;
  SENTENCE_BOUNDARY.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SENTENCE_BOUNDARY.exec(text)) !== null) {
    if (!insideMath(match.index)) lastBoundary = match.index;
  }
  if (lastBoundary === -1) return { stimulus: null, stem: text };

  const stimulus = text.slice(0, lastBoundary + 1).trim();
  const stem = text.slice(lastBoundary + 1).trim();

  // A bare question ("If 6x - 9 = 21, what is the value of x?") has no stimulus to peel off,
  // and splitting it would leave the reading pane empty.
  if (!stem || stimulus.length < MIN_STIMULUS_LENGTH) return { stimulus: null, stem: text };

  return { stimulus, stem };
}
