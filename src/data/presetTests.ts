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
  /** Scores each section from its two modules, with the easier second module worth less, so
   *  a section routed to it can't reach 800. Otherwise questions count by difficulty. */
  cappedScoring?: boolean;
}

/** Ids of a module's questions in the test's file: `${prefix}-01` … */
function moduleIds(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(i + 1).padStart(2, '0')}`);
}

/** Ids `${prefix}-01` … `${prefix}-NN`, less the numbers left out, with any of `shared`'s numbers
 *  swapped for the id of the same question in another module, so it counts once. */
function paperIds(prefix: string, count: number, leftOut: number[], shared: Record<number, string> = {}): string[] {
  return moduleIds(prefix, count)
    .map((id, i) => shared[i + 1] ?? id)
    .filter((_, i) => !leftOut.includes(i + 1));
}

export const PRESET_TESTS: PresetTest[] = [
  {
    id: 'october-2026',
    name: 'October 3rd SAT',
    description:
      'Reading and Writing, a 10-minute break, then Math, adaptive like the real test: do well on a section’s Module 1 and its Module 2 is the harder one; otherwise it’s the easier one, where the section tops out at 650 instead of 800. Take it as often as you like.',
    file: 'tests/october-2026.json',
    modules: [
      { subject: 'reading-writing', number: 1, minutes: 32, questionIds: paperIds('oct26-rw-m1', 32, [8, 14, 17, 18, 29]) },
      {
        subject: 'reading-writing',
        number: 2,
        minutes: 32,
        questionIds: paperIds('oct26-rw-m2h', 30, [20, 23, 25], { 29: 'oct26-rw-m2e-26' }),
      },
      { subject: 'math', number: 1, minutes: 35, questionIds: paperIds('oct26-math-m1', 24, [9, 16]) },
      { subject: 'math', number: 2, minutes: 35, questionIds: paperIds('oct26-math-m2h', 27, [2, 12, 14, 17, 19]) },
    ],
    // The same cut-offs as on the real test, as they're commonly estimated: about 63% right.
    routing: [
      { afterModule: 0, minCorrect: 17, easierIds: paperIds('oct26-rw-m2e', 29, [24, 27]) },
      { afterModule: 2, minCorrect: 14, easierIds: paperIds('oct26-math-m2e', 25, [4, 6, 13]) },
    ],
    cappedScoring: true,
  },
];

