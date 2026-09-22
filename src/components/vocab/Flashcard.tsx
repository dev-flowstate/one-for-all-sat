import type { VocabCard } from '../../types/vocab';

interface FlashcardProps {
  card: VocabCard;
  isFlipped: boolean;
  onFlip: () => void;
}

/**
 * The card itself: word on the front, meaning and a sentence on the back.
 *
 * Both faces are always in the DOM and absolutely positioned on top of each other, so the
 * card's height never changes as it turns — the grading buttons underneath stay put. The
 * face that's turned away is hidden from screen readers rather than just from view, so the
 * answer isn't read out before it's asked for.
 */
export function Flashcard({ card, isFlipped, onFlip }: FlashcardProps) {
  return (
    <div className="[perspective:1400px]">
      <button
        type="button"
        onClick={onFlip}
        aria-label={isFlipped ? `Hide the meaning of ${card.word}` : `Reveal the meaning of ${card.word}`}
        className="relative block min-h-72 w-full text-left transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none sm:min-h-80"
        style={{ transform: isFlipped ? 'rotateY(180deg)' : undefined }}
      >
        {/* Front */}
        <span
          aria-hidden={isFlipped}
          className="panel-raised absolute inset-0 flex flex-col items-center justify-center gap-4 px-5 py-8 [backface-visibility:hidden]"
        >
          <span className="text-center text-3xl leading-tight font-bold tracking-tight break-words uppercase sm:text-5xl">
            {card.word}
          </span>
          <span className="text-[11px] font-semibold tracking-tight text-ink-soft uppercase">Tap to reveal</span>
        </span>

        {/* Back */}
        <span
          aria-hidden={!isFlipped}
          className="panel-raised absolute inset-0 flex flex-col gap-3 overflow-y-auto px-5 py-6 [backface-visibility:hidden] [transform:rotateY(180deg)]"
        >
          <span className="flex flex-wrap items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight uppercase sm:text-2xl">{card.word}</span>
            <span className="border-2 border-ink bg-merino-dark px-1.5 py-0.5 text-[11px] font-semibold tracking-tight">
              {card.partOfSpeech}
            </span>
          </span>

          <span className="prose-reading block">{card.definition}</span>

          {/* The example is the part that makes a definition stick, so it gets its own
              framed block rather than running on as another paragraph. It follows the
              definition directly — pinned to the card's bottom instead, a one-line
              definition left a conspicuous hole in the middle of the card. */}
          <span className="block border-l-4 border-rock-blue bg-merino-dark/50 py-2 pl-3">
            <span className="prose-reading block text-[0.95rem] italic">{card.example}</span>
          </span>
        </span>
      </button>
    </div>
  );
}
