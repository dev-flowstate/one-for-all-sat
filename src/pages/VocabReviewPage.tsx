import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useVocabStore } from '../store/useVocabStore';
import { getWrongDeck, getRightDeck } from '../lib/vocab/pools';
import { Button } from '../components/ui/Button';
import { Tabs } from '../components/ui/Tabs';

type TabId = 'wrong' | 'right';

export function VocabReviewPage() {
  const cards = useVocabStore((s) => s.cards);
  const progress = useVocabStore((s) => s.progress);
  const isLoaded = useVocabStore((s) => s.isLoaded);
  const cardsLoaded = useVocabStore((s) => s.cardsLoaded);
  const ensureCards = useVocabStore((s) => s.ensureCards);
  const resetVocab = useVocabStore((s) => s.resetVocab);

  // Reachable directly by URL, so it can't assume the deck chunk is already in.
  useEffect(() => {
    void ensureCards();
  }, [ensureCards]);

  const wrong = useMemo(() => getWrongDeck(cards, progress), [cards, progress]);
  const right = useMemo(() => getRightDeck(cards, progress), [cards, progress]);

  const [tab, setTab] = useState<TabId>('wrong');
  const shown = tab === 'wrong' ? wrong : right;

  function handleResetAll() {
    if (shown.length === 0) return;
    const confirmed = window.confirm(
      `Send all ${shown.length} ${tab} word${shown.length === 1 ? '' : 's'} back to the New deck?`,
    );
    if (confirmed) resetVocab(shown.map((c) => c.id));
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <Link
        to="/vocab"
        className="mb-4 inline-block text-xs font-semibold tracking-tight text-venice-blue uppercase hover:underline"
      >
        ← Vocabulary
      </Link>

      <header className="mb-5">
        <h1 className="text-2xl leading-none font-bold tracking-tight uppercase sm:text-3xl">Word review</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Every card you&apos;ve graded. Reset any word to put it back in the New deck.
        </p>
      </header>

      <div className="mb-6">
        <Tabs
          items={[
            { id: 'wrong', label: 'Wrong', count: wrong.length },
            { id: 'right', label: 'Right', count: right.length },
          ]}
          activeId={tab}
          onChange={(id) => setTab(id as TabId)}
        />
      </div>

      {!isLoaded || !cardsLoaded ? (
        <p className="panel p-4 text-sm text-ink-soft">Loading your words…</p>
      ) : shown.length === 0 ? (
        <div className="panel px-4 py-12 text-center">
          <p className="text-sm font-semibold tracking-tight uppercase">
            {tab === 'wrong' ? 'Nothing missed yet' : 'Nothing learned yet'}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
            {tab === 'wrong'
              ? 'Words you miss land here so you can drill them again.'
              : 'Words you grade as right collect here.'}
          </p>
          <Link to="/vocab" className="mt-5 inline-block">
            <Button variant="primary">Start a deck</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* 2px gaps over an ink background draw the rules between rows, so the list keeps
              its grid however the definitions wrap. */}
          <ul className="grid gap-[2px] border-2 border-ink bg-ink">
            {shown.map((card) => (
              <li key={card.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 bg-paper px-3 py-2.5">
                <span className="text-base font-bold tracking-tight uppercase">{card.word}</span>
                <span className="text-[11px] font-semibold text-ink-soft">{card.partOfSpeech}</span>
                <span className="prose-reading w-full text-[0.95rem] text-ink-soft sm:w-auto sm:flex-1">
                  {card.definition}
                </span>
                <button
                  type="button"
                  onClick={() => resetVocab([card.id])}
                  className="text-[11px] font-semibold tracking-tight text-venice-blue uppercase hover:underline"
                >
                  Reset
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-8 border-2 border-danger bg-danger-bg shadow-[4px_4px_0_var(--color-danger)]">
            <div className="border-b-2 border-danger bg-danger px-3 py-1.5 text-xs font-semibold tracking-tight text-paper uppercase">
              Danger zone
            </div>
            <div className="p-4">
              <p className="mb-3 text-sm text-ink">
                Clears this whole list at once: every {tab} word goes back to the New deck. This cannot be
                undone.
              </p>
              <Button variant="danger" onClick={handleResetAll}>
                Reset all {tab}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
