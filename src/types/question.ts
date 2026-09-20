export type Subject = 'math' | 'reading-writing';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export type QuestionType = 'mcq' | 'spr';

export type ChoiceId = 'A' | 'B' | 'C' | 'D';

export interface Choice {
  id: ChoiceId;
  text: string;
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
  images?: QuestionImage[];
  source: 'bundled' | 'imported';
}
