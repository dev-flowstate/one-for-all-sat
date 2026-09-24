import type { TestModule, TestRouting } from '../types/practiceTest';

/** A named practice test with fixed questions, rather than one drawn from the bank. */
export interface PresetTest {
  id: string;
  name: string;
  description: string;
  modules: TestModule[];
  routing?: TestRouting;
}

/** Ids of a module's questions in the shipped bank: `${prefix}-01` … */
function moduleIds(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(i + 1).padStart(2, '0')}`);
}

export const PRESET_TESTS: PresetTest[] = [
  {
    id: 'hina-1',
    name: 'Practice Test #1 for Hina',
    description:
      'Reading and Writing from Bluebook Practice Test 1: two modules of 27 questions. As on the real test, how Module 1 goes decides whether Module 2 is the harder or the easier version.',
    modules: [
      { subject: 'reading-writing', number: 1, minutes: 32, questionIds: moduleIds('bbpt1-m1', 27) },
      { subject: 'reading-writing', number: 2, minutes: 32, questionIds: moduleIds('bbpt1-m2h', 27) },
    ],
    // College Board doesn't publish its cut-off; 17 of 27 (about 63%) sits where it's
    // commonly estimated to be.
    routing: { afterModule: 0, minCorrect: 17, easierIds: moduleIds('bbpt1-m2e', 27) },
  },
];
