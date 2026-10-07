/**
 * The heavy parts of keeping the question bank: downloading, checking and storing the shipped
 * bank (about 21 MB, mostly images), and reading every stored question to list their details.
 * They run in a worker (bankWorker.ts), so the page stays responsive to taps meanwhile, and
 * only small results come back: ids and each question's category.
 */
import { toMeta, type QuestionMeta } from '../../types/question';
import { deleteQuestions, getAllQuestionIds, getAllQuestions, getQuestionsById, mergeQuestions } from './db';
import { isWeakFingerprint, questionFingerprint } from './dedupe';
import { fetchShippedBank } from './seedBank';

export type SyncResult =
  | { status: 'absent' }
  | { status: 'invalid'; issues: string[] }
  | {
      status: 'loaded';
      revision: number;
      /** The bank's questions, as details. */
      shipped: QuestionMeta[];
      /** Every question id stored now. */
      storedIds: string[];
      /** Hand-imported questions removed as copies of shipped ones: old id to shipped id. */
      moved: Record<string, string>;
      removed: string[];
      added: number;
      updated: number;
    };

/**
 * Stores the shipped bank. Hand-imported questions the bank doesn't have are removed, and any
 * that match a shipped question by wording are reported, so their progress can follow. Stored
 * questions are rewritten only when the bank's revision is newer than `storedRevision`.
 */
export async function syncShippedBank(importedIds: string[], storedRevision: number): Promise<SyncResult> {
  const result = await fetchShippedBank();
  if (result.status !== 'loaded') return result;

  const shippedIds = new Set(result.questions.map((q) => q.id));
  const removed = importedIds.filter((id) => !shippedIds.has(id));
  const moved: Record<string, string> = {};
  if (removed.length > 0) {
    const byFingerprint = new Map(result.questions.map((q) => [questionFingerprint(q), q.id]));
    for (const q of await getQuestionsById(removed)) {
      const fingerprint = questionFingerprint(q);
      const target = isWeakFingerprint(fingerprint) ? undefined : byFingerprint.get(fingerprint);
      if (target) moved[q.id] = target;
    }
    await deleteQuestions(removed);
  }

  const { added, updated } = await mergeQuestions(result.questions, undefined, {
    updateExisting: result.revision > storedRevision,
  });
  return {
    status: 'loaded',
    revision: result.revision,
    shipped: result.questions.map(toMeta),
    storedIds: await getAllQuestionIds(),
    moved,
    removed,
    added,
    updated,
  };
}

/** Every stored question's details, read from IndexedDB. */
export async function readAllMeta(): Promise<QuestionMeta[]> {
  return (await getAllQuestions()).map(toMeta);
}
