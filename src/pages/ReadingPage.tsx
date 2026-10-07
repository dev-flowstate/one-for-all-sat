import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  BOOKS,
  fetchBook,
  getReadingProgress,
  setReadingProgress,
  tokenize,
  wordCount,
  type Book,
  type GlossaryEntry,
  type ReadingProgress,
} from '../lib/reading';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Annotatable } from '../components/annotate/Annotatable';
import { getHighlights, saveHighlights, type TextHighlight } from '../lib/doodles';

const BOOK = BOOKS[0];

/** Room left for the sticky bar when working out which paragraph is at the top of the screen. */
const TOP_OFFSET = 96;

interface Popup {
  word: string;
  head: string;
  entry: GlossaryEntry;
  /** Where the tapped word is on screen. */
  x: number;
  y: number;
  below: boolean;
}

/**
 * The reader: a book with a chapter list beside it, hard words that show their meaning when
 * tapped, and the place kept, so the next visit opens where this one stopped.
 */
export function ReadingPage() {
  const [book, setBook] = useState<Book | null>(null);
  const [failed, setFailed] = useState(false);
  const saved = useMemo(() => getReadingProgress(BOOK.id), []);
  const [progress, setProgress] = useState<ReadingProgress>(
    () => saved ?? { chapter: 0, paragraph: 0, read: 0, furthestChapter: 0, furthestParagraph: 0 },
  );
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [popup, setPopup] = useState<Popup | null>(null);
  const restored = useRef(false);
  const paragraphs = useRef<(HTMLParagraphElement | null)[]>([]);

  useEffect(() => {
    fetchBook(BOOK.id).then(setBook, () => setFailed(true));
  }, []);

  // Words before each chapter, to measure the share read.
  const offsets = useMemo(() => {
    if (!book) return null;
    const perChapter = book.chapters.map((c) => c.paragraphs.map(wordCount));
    const before: number[] = [];
    let total = 0;
    for (const counts of perChapter) {
      before.push(total);
      total += counts.reduce((a, b) => a + b, 0);
    }
    return { perChapter, before, total };
  }, [book]);

  const chapter = book?.chapters[progress.chapter];
  const tokens = useMemo(
    () => (book && chapter ? chapter.paragraphs.map((p) => tokenize(p, book.forms)) : []),
    [book, chapter],
  );

  // Opening the book goes back to the saved paragraph.
  useEffect(() => {
    if (!book || restored.current) return;
    restored.current = true;
    const target = paragraphs.current[progress.paragraph];
    if (target && progress.paragraph > 0) {
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - TOP_OFFSET });
    }
  }, [book, progress.paragraph]);

  // The paragraph at the top of the screen is the place kept; reading past the furthest point
  // reached moves it on.
  useEffect(() => {
    if (!book || !offsets) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const els = paragraphs.current;
        let index = 0;
        for (let i = 0; i < els.length; i++) {
          const el = els[i];
          if (el && el.getBoundingClientRect().bottom > TOP_OFFSET) {
            index = i;
            break;
          }
        }
        // At the very bottom, the last paragraph has been read.
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) index = els.length - 1;
        setProgress((p) => {
          if (p.paragraph === index) return p;
          const further = p.chapter > p.furthestChapter || (p.chapter === p.furthestChapter && index > p.furthestParagraph);
          const next = { ...p, paragraph: index };
          if (further) {
            next.furthestChapter = p.chapter;
            next.furthestParagraph = index;
            const done = offsets.before[p.chapter] + offsets.perChapter[p.chapter].slice(0, index + 1).reduce((a, b) => a + b, 0);
            next.read = Math.min(1, done / offsets.total);
          }
          return next;
        });
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [book, offsets, progress.chapter]);

  useEffect(() => setReadingProgress(BOOK.id, progress), [progress]);

  // A word's meaning closes on Escape, a tap elsewhere, or scrolling away from it.
  useEffect(() => {
    if (!popup) return;
    const close = () => setPopup(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    // A nudge while tapping isn't scrolling away.
    const start = window.scrollY;
    const onScroll = () => Math.abs(window.scrollY - start) > 60 && close();
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll);
    };
  }, [popup]);

  // Highlights: saved as they're made, one list per chapter, kept in the order made for Undo.
  const chapterId = `book:${BOOK.id}:${progress.chapter}`;
  const [highlights, setHighlights] = useState<TextHighlight[]>(() => getHighlights(chapterId));
  const [highlightsFor, setHighlightsFor] = useState(chapterId);
  if (highlightsFor !== chapterId) {
    setHighlightsFor(chapterId);
    setHighlights(getHighlights(chapterId));
  }

  function updateHighlights(next: TextHighlight[]) {
    setHighlights(next);
    saveHighlights(chapterId, next);
  }

  const undoHighlight = () => updateHighlights(highlights.slice(0, -1));

  /** Turns the text selection into highlights, one per paragraph it covers. */
  function highlightSelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !chapter) return;
    const range = selection.getRangeAt(0);
    const offsetIn = (el: HTMLElement, node: Node, offset: number) => {
      const r = document.createRange();
      r.setStart(el, 0);
      r.setEnd(node, offset);
      return r.toString().length;
    };
    const added: TextHighlight[] = [];
    paragraphs.current.forEach((el, p) => {
      if (!el || !range.intersectsNode(el)) return;
      const s = el.contains(range.startContainer) ? offsetIn(el, range.startContainer, range.startOffset) : 0;
      const e = el.contains(range.endContainer) ? offsetIn(el, range.endContainer, range.endOffset) : chapter.paragraphs[p].length;
      if (e > s && chapter.paragraphs[p].slice(s, e).trim()) added.push({ p, s, e });
    });
    selection.removeAllRanges();
    if (added.length === 0) return;
    // Stretching a selection that was just highlighted (dragging its handles on a phone) replaces
    // that highlight rather than stacking another on it.
    const last = highlights.at(-1);
    const extends_ = last && added.length === 1 && added[0].p === last.p && added[0].s <= last.s && added[0].e >= last.e;
    updateHighlights([...(extends_ ? highlights.slice(0, -1) : highlights), ...added]);
  }

  /** Removes the highlights covering part of a paragraph, when one is tapped. */
  function removeHighlight(p: number, s: number, e: number) {
    updateHighlights(highlights.filter((h) => h.p !== p || h.e <= s || h.s >= e));
  }

  /** A paragraph's text and hard words, with its highlights marked. */
  function renderParagraph(pieces: ReturnType<typeof tokenize>, p: number, highlighting: boolean) {
    // Overlapping highlights merged, so each stretch is marked once.
    const ranges = highlights
      .filter((h) => h.p === p)
      .map((h) => [h.s, h.e])
      .sort((a, b) => a[0] - b[0])
      .reduce<number[][]>((out, r) => {
        const prev = out.at(-1);
        if (prev && r[0] <= prev[1]) prev[1] = Math.max(prev[1], r[1]);
        else out.push([...r]);
        return out;
      }, []);
    const marked = (a: number, b: number) => ranges.some(([s, e]) => s < b && e > a);
    const markClass = 'bg-[#ffd400]/45 text-inherit';
    const out: ReactNode[] = [];
    let pos = 0;
    pieces.forEach((piece, j) => {
      if (typeof piece === 'string') {
        // Plain text is cut at each highlight's edges.
        const cuts = [pos, ...ranges.flat().filter((c) => c > pos && c < pos + piece.length), pos + piece.length];
        for (let k = 0; k < cuts.length - 1; k++) {
          const [a, b] = [cuts[k], cuts[k + 1]];
          const text = piece.slice(a - pos, b - pos);
          out.push(
            marked(a, b) ? (
              <mark
                key={`${j}-${k}`}
                className={`${markClass} ${highlighting ? 'cursor-pointer' : ''}`}
                onClick={highlighting ? () => removeHighlight(p, a, b) : undefined}
              >
                {text}
              </mark>
            ) : (
              <Fragment key={`${j}-${k}`}>{text}</Fragment>
            ),
          );
        }
        pos += piece.length;
        return;
      }
      const [a, b] = [pos, pos + piece.word.length];
      pos = b;
      const lit = marked(a, b);
      out.push(
        <button
          key={j}
          type="button"
          onClick={(e) => (highlighting ? lit && removeHighlight(p, a, b) : showWord(e, piece.word, piece.head))}
          className={`cursor-help underline decoration-venice-blue decoration-dotted decoration-2 underline-offset-4 hover:bg-merino-dark ${
            lit ? markClass : ''
          } ${highlighting ? 'select-text' : ''}`}
        >
          {piece.word}
        </button>,
      );
    });
    return out;
  }

  // On a phone, a selection is adjusted by dragging its handles, which doesn't reach the page as
  // a tap; a selection left still for a moment is highlighted then.
  useEffect(() => {
    let timer = 0;
    const onChange = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        const selection = window.getSelection();
        const article = paragraphs.current.find(Boolean)?.parentElement;
        if (!selection || selection.isCollapsed || !article?.classList.contains('cursor-text')) return;
        if (article.contains(selection.anchorNode)) highlightSelection();
      }, 900);
    };
    document.addEventListener('selectionchange', onChange);
    return () => {
      document.removeEventListener('selectionchange', onChange);
      clearTimeout(timer);
    };
  });

  function goToChapter(index: number) {
    setChaptersOpen(false);
    setPopup(null);
    paragraphs.current = [];
    setProgress((p) => ({ ...p, chapter: index, paragraph: 0 }));
    window.scrollTo({ top: 0 });
  }

  function showWord(e: React.MouseEvent<HTMLButtonElement>, word: string, head: string) {
    e.stopPropagation();
    const entry = book?.glossary[head];
    if (!entry) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const below = rect.top < 220;
    setPopup({ word, head, entry, x: rect.left + rect.width / 2, y: below ? rect.bottom : rect.top, below });
  }

  const percent = Math.round(progress.read * 100);
  const chapterList = book && (
    <ol className="flex flex-col">
      {book.chapters.map((c, i) => {
        const current = i === progress.chapter;
        const finished = i < progress.furthestChapter;
        return (
          <li key={c.title}>
            <button
              type="button"
              onClick={() => goToChapter(i)}
              aria-current={current ? 'true' : undefined}
              className={`flex w-full items-center justify-between gap-2 border-b border-merino-dark px-3 py-1.5 text-left font-mono text-xs tracking-tight uppercase ${
                current ? 'bg-venice-blue font-bold text-merino' : 'hover:bg-merino-dark'
              }`}
            >
              <span>{c.title}</span>
              {finished && <span aria-label="read">✓</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );

  return (
    <div className="min-h-screen" onClick={() => setPopup(null)}>
      <header className="sticky top-0 z-20 border-b-2 border-ink bg-merino-dark">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
          <Link to="/" className="font-mono text-xs font-semibold tracking-tight text-venice-blue uppercase hover:underline">
            ← Home
          </Link>
          <p className="min-w-0 flex-1 truncate font-mono text-xs font-bold tracking-tight uppercase">
            {BOOK.title}
            {chapter && <span className="font-normal text-ink-soft"> · {chapter.title}</span>}
          </p>
          <button
            type="button"
            onClick={() => setChaptersOpen(true)}
            className="press border-2 border-ink bg-paper px-2.5 py-1 font-mono text-xs font-bold tracking-tight uppercase lg:hidden"
          >
            Chapters
          </button>
        </div>
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pb-2">
          <div
            className="h-2.5 flex-1 border-2 border-ink bg-paper"
            role="progressbar"
            aria-label="Share of the book read"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full bg-success" style={{ width: `${percent}%` }} />
          </div>
          <span className="w-16 text-right font-mono text-xs font-bold tabular-nums">{percent}% read</span>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <nav aria-label="Chapters" className="hidden w-52 flex-none lg:block">
          <div className="panel sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">{chapterList}</div>
        </nav>

        <main className="min-w-0 flex-1">
          {failed ? (
            <p className="panel px-4 py-6 text-sm">Couldn&apos;t load the book. Check your connection and try again.</p>
          ) : !book || !chapter ? (
            <p className="panel px-4 py-6 font-mono text-xs text-ink-soft uppercase">Loading the book…</p>
          ) : (
            <article className="panel mx-auto max-w-2xl px-5 py-8 sm:px-10">
              {progress.chapter === 0 && (
                <p className="mb-8 text-center">
                  <span className="block text-3xl font-bold tracking-tight">{book.title}</span>
                  <span className="mt-1 block font-mono text-xs text-ink-soft uppercase">by {book.author}</span>
                </p>
              )}
              <h1 className="mb-6 font-mono text-sm font-bold tracking-tight text-venice-blue uppercase">{chapter.title}</h1>
              <Annotatable
                id={chapterId}
                stickyToolbar="top-[4.75rem]"
                highlighter={{ count: highlights.length, undo: undoHighlight, clear: () => updateHighlights([]) }}
              >
                {({ highlighting }) => (
                  <div
                    className={`font-reading text-[17px] leading-8 ${highlighting ? 'cursor-text select-text' : ''}`}
                    onPointerUp={highlighting ? () => setTimeout(highlightSelection, 0) : undefined}
                  >
                    {tokens.map((pieces, i) => (
                      <p
                        key={`${progress.chapter}-${i}`}
                        ref={(el) => {
                          paragraphs.current[i] = el;
                        }}
                        className="mb-4 indent-6"
                      >
                        {renderParagraph(pieces, i, highlighting)}
                      </p>
                    ))}
                  </div>
                )}
              </Annotatable>

              <div className="mt-10 flex gap-3 border-t-2 border-ink pt-5">
                {progress.chapter > 0 && (
                  <button
                    type="button"
                    onClick={() => goToChapter(progress.chapter - 1)}
                    className="press border-2 border-ink bg-paper px-4 py-2.5 font-mono text-xs font-bold tracking-tight uppercase hover:bg-merino-dark"
                  >
                    ← {book.chapters[progress.chapter - 1].title}
                  </button>
                )}
                {progress.chapter < book.chapters.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => goToChapter(progress.chapter + 1)}
                    className="press ml-auto border-2 border-ink bg-venice-blue px-4 py-2.5 font-mono text-xs font-bold tracking-tight text-merino uppercase"
                  >
                    {book.chapters[progress.chapter + 1].title} →
                  </button>
                ) : (
                  <p className="ml-auto self-center font-mono text-xs font-bold uppercase">The end</p>
                )}
              </div>
            </article>
          )}
        </main>
      </div>

      {popup && (
        <div
          role="dialog"
          aria-label={`Meaning of ${popup.word}`}
          onClick={(e) => e.stopPropagation()}
          className="panel-raised fixed z-30 w-72 max-w-[calc(100vw-2rem)] p-3"
          style={{
            left: Math.min(Math.max(16, popup.x - 144), window.innerWidth - Math.min(288, window.innerWidth - 32) - 16),
            top: popup.below ? popup.y + 8 : undefined,
            bottom: popup.below ? undefined : window.innerHeight - popup.y + 8,
          }}
        >
          <p className="flex items-baseline gap-2">
            <span className="text-lg font-bold">{popup.head}</span>
            <span className="font-mono text-xs text-ink-soft">{popup.entry.p}</span>
            {popup.entry.sat && (
              <span className="ml-auto border-2 border-ink bg-venice-blue px-1.5 font-mono text-[10px] font-bold text-merino uppercase">
                SAT word
              </span>
            )}
          </p>
          <p className="mt-1 text-sm">{popup.entry.d}</p>
        </div>
      )}

      <ConfirmDialog open={chaptersOpen} title="Chapters" confirmLabel="Close" onConfirm={() => setChaptersOpen(false)}>
        <div className="-mx-4 -my-4 max-h-[60vh] overflow-y-auto">{chapterList}</div>
      </ConfirmDialog>
    </div>
  );
}
