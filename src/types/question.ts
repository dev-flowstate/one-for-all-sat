export type Subject = 'math' | 'reading-writing';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export type QuestionType = 'mcq' | 'spr';

export type ChoiceId = 'A' | 'B' | 'C' | 'D';

export interface Choice {
  id: ChoiceId;
  text: string;
  /** Set when the choice's value was typeset as a graphic in the source and couldn't be
   *  extracted as text — render this instead of `text`, which is only a placeholder then. */
  image?: string;
}

export interface QuestionImage {
  src: string;
  alt?: string;
}

export interface Question {
  id: string;
  subject: Subject;
  domain: string;
  skill: string;
  difficulty: Difficulty;
  type: QuestionType;
  /** Reading stimulus / shared passage text. Plain text only — paragraphs separated by "\n\n". */
  passage?: string;
  /** The question stem. Plain text only (required by the offset-based highlighter). */
  prompt: string;
  /** Present for type: 'mcq' only. */
  choices?: Choice[];
  /** Present for type: 'mcq' only. */
  correctChoice?: ChoiceId;
  /** Present for type: 'spr' only — every equivalent accepted form. */
  acceptableAnswers?: string[];
  explanation: string;
  /** True when `prompt` lost content that was typeset as a graphic in the source, so the
   *  text alone reads broken ("what is the value of ?"). Render the image instead. */
  promptIsPartial?: boolean;
  images?: QuestionImage[];
  /** Character ranges of the passage shown underlined, for questions that ask about "the
   *  underlined sentence". Kept apart from the text so the text stays plain and highlight
   *  offsets are unaffected. Relative to `passage`, or to the stimulus split from `prompt`. */
  underlines?: { start: number; end: number }[];
  /** Belongs to a named practice test, so it's kept out of practice sets and generated tests
   *  until it's been answered there. */
  testOnly?: boolean;
  source: 'bundled' | 'imported';
}
