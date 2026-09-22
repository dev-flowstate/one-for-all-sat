import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Question } from '../../types/question';

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
 * Used by the Import feature — replaces any previously-imported bank with a new one.
 * `source` is forced here so callers don't need to copy the whole array just to set it.
 */
export async function replaceImportedQuestions(
  questions: Question[],
  onProgress?: (written: number, total: number) => void,
): Promise<void> {
  const db = await getDB();

  // Clear the old bank in its own transaction, so a large delete and a large write are
  // never held open together.
  const clearTx = db.transaction('questions', 'readwrite');
  let cursor = await clearTx.store.index('by-source').openCursor(IDBKeyRange.only('imported'));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await clearTx.done;

  for (let start = 0; start < questions.length; start += WRITE_CHUNK) {
    const chunk = questions.slice(start, start + WRITE_CHUNK);
    const tx = db.transaction('questions', 'readwrite');
    await Promise.all(chunk.map((q) => tx.store.put({ ...q, source: 'imported' })));
    await tx.done;
    onProgress?.(Math.min(start + WRITE_CHUNK, questions.length), questions.length);
  }
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

export async function clearImportedQuestions(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('questions', 'readwrite');
  let cursor = await tx.store.index('by-source').openCursor(IDBKeyRange.only('imported'));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}
