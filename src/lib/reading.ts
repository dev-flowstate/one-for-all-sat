/** The reading section: books, loading them, and where each reader has got to. */

export interface GlossaryEntry {
  /** Part of speech. */
  p: string;
  /** Definition, in the sense the book uses the word. */
  d: string;
  /** Also in the site's SAT vocabulary deck. */
  sat: boolean;
}

export interface Book {
  title: string;
  author: string;
  chapters: { title: string; paragraphs: string[] }[];
  /** Hard words, by headword. */
  glossary: Record<string, GlossaryEntry>;
  /** Every form of a hard word found in the book ("entreated"), lowercased, to its headword. */
  forms: Record<string, string>;
}

export const BOOKS = [
  { id: 'pride-and-prejudice', title: 'Pride and Prejudice', author: 'Jane Austen', file: 'books/pride-and-prejudice.json' },
] as const;

export type BookId = (typeof BOOKS)[number]['id'];

const cache = new Map<string, Promise<Book>>();

/** The book's text, fetched once per visit. It's about 760 kB, so only the reader asks for it. */
export function fetchBook(id: BookId): Promise<Book> {
  let promise = cache.get(id);
  if (!promise) {
    const file = BOOKS.find((b) => b.id === id)!.file;
    promise = fetch(`${import.meta.env.BASE_URL}${file}`).then((r) => {
      if (!r.ok) throw new Error(`Couldn't load ${file}`);
      return r.json() as Promise<Book>;
    });
    promise.catch(() => cache.delete(id));
    cache.set(id, promise);
  }
  return promise;
}

export interface ReadingProgress {
  /** Where the reader is: a chapter, and the paragraph at the top of the screen. */
  chapter: number;
  paragraph: number;
  /** The share of the book read, 0 to 1, by the furthest point reached. */
  read: number;
  /** The furthest point reached, which `read` is measured to. */
  furthestChapter: number;
  furthestParagraph: number;
}

const key = (id: BookId) => `ofa-sat:reading:${id}`;

/** Saved in this browser, so the home screen can show it without loading the book. */
export function getReadingProgress(id: BookId): ReadingProgress | null {
  try {
    const raw = localStorage.getItem(key(id));
    return raw ? (JSON.parse(raw) as ReadingProgress) : null;
  } catch {
    return null;
  }
}

export function setReadingProgress(id: BookId, progress: ReadingProgress): void {
  try {
    localStorage.setItem(key(id), JSON.stringify(progress));
  } catch {
    // Without storage, the place is kept only until the page is left.
  }
}

/** Words in a paragraph, roughly: enough to measure how much has been read. */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** The pieces of a paragraph: plain text, and hard words with the headword they belong to. */
export function tokenize(text: string, forms: Record<string, string>): (string | { word: string; head: string })[] {
  const out: (string | { word: string; head: string })[] = [];
  let last = 0;
  for (const match of text.matchAll(/[A-Za-z]+(?:[-’'][A-Za-z]+)*/g)) {
    const head = forms[match[0].toLowerCase()];
    if (!head) continue;
    if (match.index > last) out.push(text.slice(last, match.index));
    out.push({ word: match[0], head });
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
