import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Question } from '../../types/question';
import { questionFingerprint, isWeakFingerprint } from './dedupe';

interface SatDB extends DBSchema {
  questions: {
    key: string;
    value: Question;
    indexes: { 'by-source': string };
  };
}

const DB_NAME = 'one-for-all-sat';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<SatDB>> | null = null;

function getDB(): Promise<IDBPDatabase<SatDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SatDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('questions', { keyPath: 'id' });
        store.createIndex('by-source', 'source');
      },
    });
  }
  return dbPromise;
}

/** Seeds the bundled demo set on first run only — never overwrites an existing bundled set. */
export async function ensureBundledSeeded(bundled: Question[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('questions', 'readwrite');
  const existing = await tx.store.index('by-source').count('bundled');
  if (existing === 0) {
    await Promise.all(bundled.map((q) => tx.store.put(q)));
  }
  await tx.done;
}

/** Records written per transaction. A whole bank in one transaction can hold tens of MB of
 *  inline images open at once, which is enough to hit a phone's storage quota or get the
 *  tab killed; chunking keeps each commit small and lets the UI report progress. */
const WRITE_CHUNK = 100;

/**
 * Adds questions that aren't already stored, and touches nothing else.
 *
 * This is how the bank that ships with the app meets a bank someone imported by hand. It
 * never deletes, so a student who imported a larger set keeps every question in it, and it
 * never rewrites an existing row's id — progress is keyed by question id in localStorage, so
 * re-adding the same question under a new id is exactly what would resurrect a question
 * they had already answered. Duplicates are dropped in favour of the copy already stored.
 *
 * Ids are checked first because that read is only the keys. The value read that follows
 * costs real memory once a bank of inline images is stored, and after the first run there is
 * usually nothing new to add, so it is skipped entirely.
 */
export async function mergeQuestions(
  incoming: Question[],
  onProgress?: (written: number, total: number) => void,
  { updateExisting = false }: { updateExisting?: boolean } = {},
): Promise<{ added: number; updated: number; duplicates: number }> {
  const db = await getDB();
  const storedIds = new Set(await db.getAllKeys('questions'));

  // An explicit import rewrites questions it already has, so re-importing a corrected file
  // actually corrects them. The startup merge doesn't: it runs on every load, and rewriting
  // the whole shipped bank each time would cost far more than it could ever fix.
  const updates = updateExisting ? incoming.filter((q) => storedIds.has(q.id)) : [];
  const candidates = incoming.filter((q) => !storedIds.has(q.id));
  if (candidates.length === 0 && updates.length === 0) {
    return { added: 0, updated: 0, duplicates: incoming.length };
  }

  // Same question, different id: the two converters number their output differently, so a
  // match on wording has to be caught as well or it would be stored twice.
  const storedFingerprints = new Set<string>();
  if (candidates.length > 0) {
    const readTx = db.transaction('questions', 'readonly');
    let cursor = await readTx.store.openCursor();
    while (cursor) {
      const fingerprint = questionFingerprint(cursor.value);
      if (!isWeakFingerprint(fingerprint)) storedFingerprints.add(fingerprint);
      cursor = await cursor.continue();
    }
    await readTx.done;
  }

  const toAdd: Question[] = [];
  for (const question of candidates) {
    const fingerprint = questionFingerprint(question);
    if (!isWeakFingerprint(fingerprint) && storedFingerprints.has(fingerprint)) continue;
    if (!isWeakFingerprint(fingerprint)) storedFingerprints.add(fingerprint);
    toAdd.push(question);
  }

  // Progress counts against everything handed in, with the questions skipped as duplicates
  // already done, so an import's progress bar still finishes at 100%.
  const toWrite = [...updates, ...toAdd];
  const skipped = incoming.length - toWrite.length;
  for (let start = 0; start < toWrite.length; start += WRITE_CHUNK) {
    const chunk = toWrite.slice(start, start + WRITE_CHUNK);
    const tx = db.transaction('questions', 'readwrite');
    await Promise.all(chunk.map((q) => tx.store.put({ ...q, source: 'imported' })));
    await tx.done;
    onProgress?.(skipped + Math.min(start + WRITE_CHUNK, toWrite.length), incoming.length);
  }

  return { added: toAdd.length, updated: updates.length, duplicates: skipped };
}

export async function getAllQuestions(): Promise<Question[]> {
  const db = await getDB();
  return db.getAll('questions');
}

export async function getQuestionCounts(): Promise<{ bundled: number; imported: number }> {
  const db = await getDB();
  const [bundled, imported] = await Promise.all([
    db.countFromIndex('questions', 'by-source', 'bundled'),
    db.countFromIndex('questions', 'by-source', 'imported'),
  ]);
  return { bundled, imported };
}
