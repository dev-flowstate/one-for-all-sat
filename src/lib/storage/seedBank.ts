import { questionBankFileSchema } from '../schema';
import type { Question } from '../../types/question';

/** Where the shipped bank lives, relative to the app's base path. */
const BANK_FILE = 'question-bank.json';

export type BankLoadResult =
  | { status: 'loaded'; revision: number; questions: Question[] }
  | { status: 'absent' }
  | { status: 'invalid'; issues: string[] };

/**
 * Loads the question bank that ships with the app, if one is present.
 *
 * The file is optional by design: a checkout without it still runs on the bundled demo
 * set rather than erroring, so a missing or half-copied file degrades to "fewer questions"
 * instead of a broken app.
 */
export function fetchShippedBank(): Promise<BankLoadResult> {
  return fetchQuestionFile(BANK_FILE);
}

/** Loads a question file shipped with the app: the bank, or a named test's questions. */
export async function fetchQuestionFile(file: string): Promise<BankLoadResult> {
  let payload: unknown;
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}${file}`);
    if (!response.ok) return { status: 'absent' };
    payload = await response.json();
  } catch {
    // Missing file, offline, or a dev server returning index.html for an unknown path.
    return { status: 'absent' };
  }

  const parsed = questionBankFileSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      status: 'invalid',
      issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    };
  }

  // Force the source regardless of what the file claims, so these always count as the
  // imported bank and can be replaced wholesale later.
  return {
    status: 'loaded',
    revision: parsed.data.revision ?? 0,
    questions: parsed.data.questions.map((q) => ({ ...q, source: 'imported' as const })),
  };
}
