import type { TestModule, TestRouting } from '../types/practiceTest';

/** A named practice test with fixed questions, rather than one drawn from the bank. */
export interface PresetTest {
  id: string;
  name: string;
  description: string;
  /** The test's questions, relative to the site's base path. They're kept out of the shipped
   *  bank so they never turn up in practice, and are loaded when the tests page opens. */
  file: string;
  modules: TestModule[];
  routing?: TestRouting[];
}

/** Ids of a module's questions in the test's file: `${prefix}-01` … */
function moduleIds(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(i + 1).padStart(2, '0')}`);
}

export const PRESET_TESTS: PresetTest[] = [
  {
    id: 'hina-1',
    name: 'Practice Test #1 for Hina',
    description:
      'Bluebook Practice Test 1: Reading and Writing, a 10-minute break, then Math. As on the real test, how each section’s Module 1 goes decides whether its Module 2 is the harder or the easier version.',
    file: 'tests/hina-1.json',
    modules: [
      { subject: 'reading-writing', number: 1, minutes: 32, questionIds: moduleIds('bbpt1-m1', 27) },
      { subject: 'reading-writing', number: 2, minutes: 32, questionIds: moduleIds('bbpt1-m2h', 27) },
      { subject: 'math', number: 1, minutes: 35, questionIds: moduleIds('bbpt1-math-m1', 22) },
      { subject: 'math', number: 2, minutes: 35, questionIds: moduleIds('bbpt1-math-m2h', 22) },
    ],
    // College Board doesn't publish its cut-offs; about 63% right (17 of 27, 14 of 22) sits
    // where they're commonly estimated to be.
    routing: [
      { afterModule: 0, minCorrect: 17, easierIds: moduleIds('bbpt1-m2e', 27) },
      { afterModule: 2, minCorrect: 14, easierIds: moduleIds('bbpt1-math-m2e', 22) },
    ],
  },
];

/** A paper whose second modules the student picks, medium or hard, instead of being routed. */
export interface PaperTest {
  id: string;
  name: string;
  description: string;
  file: string;
  sections: { baseline: TestModule; medium: TestModule; hard: TestModule }[];
}

/** Module ids, with any question that also appears word for word in the other version of the
 *  module kept under the one id, so it counts once however many times it's answered. */
function idsWithShared(prefix: string, count: number, shared: Record<number, string>): string[] {
  return moduleIds(prefix, count).map((id, i) => shared[i + 1] ?? id);
}

/** Minutes for a module, at the real test's pace: 32 minutes per 27 Reading and Writing
 *  questions, 35 per 22 Math. */
function minutesFor(subject: 'reading-writing' | 'math', count: number): number {
  return Math.round(subject === 'math' ? (count * 35) / 22 : (count * 32) / 27);
}

function paperModule(subject: 'reading-writing' | 'math', number: 1 | 2, questionIds: string[]): TestModule {
  return { subject, number, minutes: minutesFor(subject, questionIds.length), questionIds };
}

export const PAPER_TESTS: PaperTest[] = [
  {
    id: 'october-2026',
    name: 'October 3rd SAT',
    description:
      'Reading and Writing, a 10-minute break, then Math. Each section starts with a baseline module; you choose whether its second module is the medium or the hard one.',
    file: 'tests/october-2026.json',
    sections: [
      {
        baseline: paperModule('reading-writing', 1, moduleIds('oct26-rw-m1', 32)),
        medium: paperModule('reading-writing', 2, moduleIds('oct26-rw-m2e', 29)),
        hard: paperModule('reading-writing', 2, idsWithShared('oct26-rw-m2h', 30, { 29: 'oct26-rw-m2e-26' })),
      },
      {
        baseline: paperModule('math', 1, moduleIds('oct26-math-m1', 24)),
        medium: paperModule('math', 2, moduleIds('oct26-math-m2e', 25)),
        hard: paperModule('math', 2, idsWithShared('oct26-math-m2h', 27, { 12: 'oct26-math-m2e-05', 17: 'oct26-math-m2e-20' })),
      },
    ],
  },
];

/** The modules of a paper on a chosen path: each section's baseline then its chosen second
 *  module, or the chosen second modules alone. */
export function paperModules(paper: PaperTest, level: 'medium' | 'hard', module2Only: boolean): TestModule[] {
  return paper.sections.flatMap((s) => (module2Only ? [s[level]] : [s.baseline, s[level]]));
}
