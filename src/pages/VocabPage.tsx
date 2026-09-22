import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useVocabStore, type VocabDeckSource } from '../store/useVocabStore';
import { getUnseenDeck, getWrongDeck, getRightDeck } from '../lib/vocab/pools';
import { Button } from '../components/ui/Button';

const SIZES = [10, 20, 30, 50] as const;

export function VocabPage() {
  const navigate = useNavigate();
  const cards = useVocabStore((s) => s.cards);
  const progress = useVocabStore((s) => s.progress);
  const isLoaded = useVocabStore((s) => s.isLoaded);
  const cardsLoaded = useVocabStore((s) => s.cardsLoaded);
  const ensureCards = useVocabStore((s) => s.ensureCards);
  const startSession = useVocabStore((s) => s.startSession);

  // The deck lives in its own chunk, so it's fetched on arrival here rather than at startup.
  useEffect(() => {
    void ensureCards();
  }, [ensureCards]);

  const ready = isLoaded && cardsLoaded;

  const counts = useMemo(
    () => ({
      unseen: getUnseenDeck(cards, progress).length,
      wrong: getWrongDeck(cards, progress).length,
      right: getRightDeck(cards, progress).length,
      all: cards.length,
    }),
    [cards, progress],
  );

  const [source, setSource] = useState<VocabDeckSource>('unseen');
  const [size, setSize] = useState<number>(20);

  const available = counts[source];
  const deckSize = Math.min(size, available);

  const sources: { id: VocabDeckSource; label: string; hint: string; cap: string }[] = [
    { id: 'unseen', label: 'New', hint: 'Not graded yet', cap: 'bg-rock-blue text-ink' },
    { id: 'wrong', label: 'Wrong', hint: 'Missed before', cap: 'bg-danger text-paper' },
    { id: 'right', label: 'Right', hint: 'Already known', cap: 'bg-success text-paper' },
    { id: 'all', label: 'All', hint: 'Whole deck', cap: 'bg-venice-blue text-merino' },
  ];

  function handleStart() {
    if (deckSize === 0) return;
    startSession(source, deckSize);
    navigate('/vocab/drill');
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <Link
        to="/"
        className="mb-4 inline-block text-xs font-semibold tracking-tight text-venice-blue uppercase hover:underline"
      >
        ← Home
      </Link>

      <header className="mb-6">
        <p className="text-[11px] font-semibold tracking-tight text-ink-soft uppercase">Flashcards</p>
        <h1 className="mt-1 text-2xl leading-none font-bold tracking-tight uppercase sm:text-3xl">Vocabulary</h1>
        <p className="mt-2 text-sm text-ink-soft">
          {ready ? `${counts.all} words. ` : ''}Word on the front, meaning and a sentence on the back — grade
          yourself and the card files itself into Wrong or Right.
        </p>
      </header>

      {/* Pool counts. Same three-up treatment as the home screen, so the two sections read
          as siblings rather than unrelated screens. */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {sources.slice(0, 3).map((pool) => (
          <div key={pool.id} className="panel">
            <p
              className={`border-b-2 border-ink px-2 py-1 text-center text-[10px] font-semibold tracking-tight uppercase sm:text-[11px] ${pool.cap}`}
            >
              {pool.label}
            </p>
            <p className="px-2 py-4 text-center text-3xl font-bold tabular-nums sm:py-5 sm:text-4xl">
              {ready ? counts[pool.id] : '—'}
            </p>
          </div>
        ))}
      </div>

      <section className="mt-6">
        <h2 className="mb-2 text-[11px] font-semibold tracking-tight text-ink-soft uppercase">Draw from</h2>
        <div className="grid grid-cols-2 gap-[2px] border-2 border-ink bg-ink sm:grid-cols-4">
          {sources.map((option) => {
            const active = source === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSource(option.id)}
                aria-pressed={active}
                className={`min-h-16 px-3 py-2.5 text-left ${active ? 'bg-venice-blue text-merino' : 'bg-paper text-ink hover:bg-merino-dark'}`}
              >
                <span className="block text-sm font-bold tracking-tight uppercase">{option.label}</span>
                <span className={`block text-[11px] ${active ? 'text-merino/70' : 'text-ink-soft'}`}>
                  {option.hint} · {counts[option.id]}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-[11px] font-semibold tracking-tight text-ink-soft uppercase">How many cards</h2>
        <div className="flex flex-wrap gap-2">
          {SIZES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSize(option)}
              aria-pressed={size === option}
              disabled={available === 0}
              className={`panel press min-h-11 min-w-16 px-4 py-2 text-sm font-bold tabular-nums disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${
                size === option ? 'bg-venice-blue text-merino' : 'bg-paper text-ink hover:bg-merino-dark'
              }`}
            >
              {option}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSize(counts.all)}
            aria-pressed={size >= available && available > 0}
            disabled={available === 0}
            className={`panel press min-h-11 px-4 py-2 text-sm font-bold uppercase disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${
              size >= available && available > 0 ? 'bg-venice-blue text-merino' : 'bg-paper text-ink hover:bg-merino-dark'
            }`}
          >
            All
          </button>
        </div>
      </section>

      <div className="mt-6">
        <Button
          variant="primary"
          className="w-full py-4 text-base sm:py-5"
          onClick={handleStart}
          disabled={!ready || deckSize === 0}
        >
          {!ready ? 'Loading words…' : deckSize === 0 ? 'Nothing in this deck' : `Start ${deckSize} card${deckSize === 1 ? '' : 's'}`}
        </Button>
        <Link to="/vocab/review" className="mt-3 block">
          <Button variant="secondary" className="w-full">
            Review wrong &amp; right
          </Button>
        </Link>
      </div>
    </div>
  );
}
