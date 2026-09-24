import type { TestModule } from '../../types/practiceTest';
import { sectionTitle } from './buildTest';

/** "Section 1, Module 2: Reading and Writing", the way the test labels it. */
export function moduleTitle(module: TestModule): string {
  const section = module.subject === 'reading-writing' ? 1 : 2;
  return `Section ${section}, Module ${module.number}: ${sectionTitle(module.subject)}`;
}

/** What to call a test, including older saved ones that were only numbered. */
export function testName(test: { name?: string; number: number }): string {
  return test.name ?? `Practice Test ${test.number}`;
}

/** 1834 → "30:34" */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
