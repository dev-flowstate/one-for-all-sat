import { Link } from 'react-router-dom';
import { BOOKS, getReadingProgress } from '../../lib/reading';

/** The home screen's way into the reader: the book, how much of it is read, and where to pick up. */
export function ReadingCard() {
  const book = BOOKS[0];
  const progress = getReadingProgress(book.id);
  const percent = Math.round((progress?.read ?? 0) * 100);

  return (
    <section
      aria-labelledby="reading-card-title"
      className="mt-4 flex flex-col gap-3 border-2 border-ink bg-paper px-4 py-4 shadow-[4px_4px_0_var(--color-ink)] sm:mt-6 sm:flex-row sm:items-center sm:px-6"
    >
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] font-semibold tracking-tight text-ink-soft uppercase">Reading</p>
        <h2 id="reading-card-title" className="mt-0.5 text-lg leading-tight font-bold tracking-tight">
          {book.title} <span className="text-sm font-normal text-ink-soft">by {book.author}</span>
        </h2>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-2.5 flex-1 border-2 border-ink bg-merino">
            <div className="h-full bg-success" style={{ width: `${percent}%` }} />
          </div>
          <span className="font-mono text-xs font-bold tabular-nums">{percent}%</span>
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          {progress ? `You're in chapter ${progress.chapter + 1} of 61.` : 'Tap any underlined word to see what it means.'}
        </p>
      </div>
      <Link
        to="/read"
        className="press flex min-h-11 flex-none items-center justify-center border-2 border-ink bg-venice-blue px-5 py-2.5 font-mono text-sm font-bold tracking-tight text-merino uppercase"
      >
        {progress ? 'Continue reading' : 'Start reading'}
      </Link>
    </section>
  );
}
