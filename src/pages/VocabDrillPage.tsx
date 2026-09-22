import { useMemo } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useVocabStore } from '../store/useVocabStore';
import { Flashcard } from '../components/vocab/Flashcard';
import { Button } from '../components/ui/Button';
import { ProgressBar } from '../components/ui/ProgressBar';

export function VocabDrillPage() {
  const navigate = useNavigate();
  const cards = useVocabStore((s) => s.cards);
  const deck = useVocabStore((s) => s.deck);
  const isFlipped = useVocabStore((s) => s.isFlipped);
  const sessionSize = useVocabStore((s) => s.sessionSize);
  const sessionOutcomes = useVocabStore((s) => s.sessionOutcomes);
  const requeued = useVocabStore((s) => s.requeued);
  const flip = useVocabStore((s) => s.flip);
  const grade = useVocabStore((s) => s.grade);
  const endSession = useVocabStore((s) => s.endSession);

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const outcomes = Object.values(sessionOutcomes);
  const rightCount = outcomes.filter((o) => o === 'right').length;
  const wrongCount = outcomes.filter((o) => o === 'wrong').length;

  // Landed here without starting a session (a refresh, or a typed URL) — nothing to show.
  if (sessionSize === 0) return <Navigate to="/vocab" replace />;

  // Deck run down: the summary replaces the card rather than living on its own route, so
  // a refresh here can't strand the user on a results page with no session behind it.
  if (deck.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
        <div className="panel-raised">
          <div className="border-b-2 border-ink bg-ink px-3 py-1.5 text-[11px] font-semibold tracking-tight text-merino uppercase">
            Deck complete
          </div>
          <div className="px-4 py-8 text-center sm:px-6">
            <p className="text-5xl font-bold tabular-nums">
              {rightCount}
              <span className="text-2xl text-ink-soft">/{rightCount + wrongCount}</span>
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              {wrongCount === 0
                ? 'Clean sweep — every card went to Right.'
                : `${wrongCount} card${wrongCount === 1 ? '' : 's'} went to Wrong for another pass.`}
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <Button
                variant="primary"
                className="w-full"
                onClick={() => {
                  endSession();
                  navigate('/vocab');
                }}
              >
                Another deck
              </Button>
              <Link to="/vocab/review" onClick={endSession}>
                <Button variant="secondary" className="w-full">
                  Review wrong ({wrongCount})
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const card = byId.get(deck[0]);
  if (!card) return <Navigate to="/vocab" replace />;

  // Cards sent to the back are still in `deck`, so counting what's left would make the bar
  // run backwards on a miss. Graded-distinct-cards over session size only ever moves forward.
  const graded = Object.keys(sessionOutcomes).length;
  const isSecondLook = requeued.includes(card.id);

  function handleExit() {
    endSession();
    navigate('/vocab');
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 sm:py-8">
      <div className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={handleExit}
          className="text-xs font-semibold tracking-tight text-venice-blue uppercase hover:underline"
        >
          ← Exit
        </button>
        <span className="panel-flat px-2 py-1 text-xs font-semibold tabular-nums">
          {Math.min(graded + 1, sessionSize)}/{sessionSize}
        </span>
        <div className="flex-1">
          <ProgressBar value={(graded / sessionSize) * 100} />
        </div>
      </div>

      {/* Reserved whether or not it's showing, so the card doesn't shift up and down as
          cards come back round. */}
      <p className="mb-2 min-h-5 text-center text-[11px] font-semibold tracking-tight text-coral uppercase">
        {isSecondLook ? 'Second look' : ''}
      </p>

      <Flashcard card={card} isFlipped={isFlipped} onFlip={flip} />

      {/* One row, two states. Grading is only offered once the meaning is showing —
          otherwise "I got it right" is a guess, not a judgement. */}
      <div className="mt-5">
        {isFlipped ? (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="danger" className="py-4" onClick={() => grade('wrong')}>
              Got it wrong
            </Button>
            <Button variant="success" className="py-4" onClick={() => grade('right')}>
              Got it right
            </Button>
          </div>
        ) : (
          <Button variant="secondary" className="w-full py-4" onClick={flip}>
            Show meaning
          </Button>
        )}
      </div>
    </div>
  );
}
