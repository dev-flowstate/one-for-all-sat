import type { ChoiceId, Subject } from './question';
import type { SessionAnswer } from './progress';

export interface TestModule {
  subject: Subject;
  /** Module 1 or 2 of its section. */
  number: 1 | 2;
  minutes: number;
  questionIds: string[];
}

/** What's been entered for a question so far. Nothing is graded until the test ends, so an
 *  answer can be changed as often as you like while its module is open. */
export interface TestResponse {
  choice?: ChoiceId;
  text?: string;
}

export type TestStage =
  | { kind: 'module'; module: number; view: 'question' | 'review' }
  | { kind: 'break' };

/** A test in progress. Saved on every change, so closing the tab loses nothing. */
export interface ActiveTest {
  number: number;
  createdAt: string;
  /** Untimed tests have no module clocks and no break countdown. */
  timed: boolean;
  modules: TestModule[];
  stage: TestStage;
  /** Position within the current module. */
  currentIndex: number;
  responses: Record<string, TestResponse>;
  /** Question ids flagged with "Mark for review". */
  marked: string[];
  /** What's left on the running clock, the module's or the break's. Stored as a count rather
   *  than a deadline so the clock doesn't run while the site is closed. Unused when untimed. */
  secondsLeft: number;
}

export interface DomainTally {
  subject: Subject;
  domain: string;
  total: number;
  wrong: number;
}

export interface CompletedTest {
  number: number;
  createdAt: string;
  completedAt: string;
  timed: boolean;
  readingWriting: number;
  math: number;
  total: number;
  /** Every question in test order. A question left blank counts as incorrect, as on the SAT. */
  answers: SessionAnswer[];
  domains: DomainTally[];
}
