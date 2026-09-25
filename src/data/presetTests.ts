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
