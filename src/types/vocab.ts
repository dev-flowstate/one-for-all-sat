/** Kept to the four the SAT actually tests; anything else would just be trivia. */
export type PartOfSpeech = 'n.' | 'v.' | 'adj.' | 'adv.';

export interface VocabCard {
  /** The word itself, lowercased — words are unique, so they make a stable key. */
  id: string;
  word: string;
  partOfSpeech: PartOfSpeech;
  /** Front-of-card is the word alone; this and `example` are the back. */
  definition: string;
  /** One sentence using the word, so the definition has something to stick to. */
  example: string;
}

/**
 * 'wrong' and 'right' are named for the buttons the user actually presses, rather than
 * borrowed from the question bank's 'correct'/'incorrect' — the two progress maps are
 * stored separately and never mix.
 */
export type VocabCardStatus = 'unseen' | 'right' | 'wrong';

export interface VocabStatus {
  status: VocabCardStatus;
  /** How many times the card has been graded, across all sessions. */
  reviews: number;
  lastReviewedAt?: string;
}

/** word id -> status. The single source the New/Wrong/Right decks are derived from. */
export type VocabProgressMap = Record<string, VocabStatus>;
