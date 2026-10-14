import type { VocabCard } from '../../types/vocab';
import { Annotatable } from '../annotate/Annotatable';

interface FlashcardProps {
  card: VocabCard;
  isFlipped: boolean;
  /** Left out where the card is only shown, turned to its meaning (the Saved doodles page). */
  onFlip?: () => void;
}

/**
 * The card itself: word on the front, meaning and a sentence on the back.
 *
 * Both faces are always in the DOM and absolutely positioned on top of each other, so the
 * card's height never changes as it turns — the grading buttons underneath stay put. The
 * face that's turned away is inert: hidden from screen readers and out of the tab order, so
 * the answer isn't read out before it's asked for.
 *
 * The front is one big button that turns the card. The back isn't, because the meaning can
 * be drawn on: a doodle saved there is kept with the word and shown whenever it comes round.
 * A small button in its corner turns it back.
 */
export function Flashcard({ card, isFlipped, onFlip }: FlashcardProps) {
  return (
    <div className="[perspective:1400px]">
      <div
        className="relative min-h-72 w-full transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none sm:min-h-80"
        style={{ transform: isFlipped ? 'rotateY(180deg)' : undefined }}
      >
        {/* Front */}
        <button
          type="button"
          onClick={onFlip}
          inert={isFlipped}
          aria-label={`Reveal the meaning of ${card.word}`}
          className="panel-raised absolute inset-0 flex flex-col items-center justify-center gap-4 px-5 py-8 [backface-visibility:hidden]"
        >
          <span className="text-center text-3xl leading-tight font-bold tracking-tight break-words uppercase sm:text-5xl">
            {card.word}
          </span>
          <span className="text-[11px] font-semibold tracking-tight text-ink-soft uppercase">Tap to reveal</span>
        </button>

        {/* Back */}
        <div
          inert={!isFlipped}
          className="panel-raised absolute inset-0 flex flex-col gap-3 overflow-y-auto px-5 py-6 [backface-visibility:hidden] [transform:rotateY(180deg)]"
        >
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight uppercase sm:text-2xl">{card.word}</span>
            <span className="border-2 border-ink bg-merino-dark px-1.5 py-0.5 text-[11px] font-semibold tracking-tight">
              {card.partOfSpeech}
            </span>
            {onFlip && (
            <button
              type="button"
              onClick={onFlip}
              aria-label={`Hide the meaning of ${card.word}`}
              className="ml-auto self-center border-2 border-ink bg-paper px-2 py-1 font-mono text-[11px] font-bold uppercase hover:bg-merino-dark"
            >
              ↺ Word
            </button>
            )}
          </div>

          <Annotatable id={`vocab:${card.id}`}>
            <div className="flex min-h-36 flex-col gap-3">
              <p className="prose-reading">{card.definition}</p>

              {/* The example is the part that makes a definition stick, so it gets its own
                  framed block rather than running on as another paragraph. It follows the
                  definition directly — pinned to the card's bottom instead, a one-line
                  definition left a conspicuous hole in the middle of the card. */}
              <p className="prose-reading border-l-4 border-rock-blue bg-merino-dark/50 py-2 pl-3 text-[0.95rem] italic">
                {card.example}
              </p>
            </div>
          </Annotatable>
        </div>
      </div>
    </div>
  );
}
