import type { Choice, ChoiceId } from '../../types/question';
import type { RevealMode } from '../../types/settings';

interface McqChoicesProps {
  choices: Choice[];
  crossedIds: ChoiceId[];
  submitted: boolean;
  /** answers[question.id]?.selectedChoice — only meaningful once submitted. */
  selectedChoice?: string;
  correctChoice?: ChoiceId;
  revealMode: RevealMode;
  onChoiceClick: (choiceId: ChoiceId) => void;
}

/**
 * Full-width stacked choice buttons. Purely presentational — all crosser/selection
 * decision logic lives in the caller's onChoiceClick; this component just renders the
 * resulting visual state and forwards clicks.
 */
export function McqChoices({
  choices,
  crossedIds,
  submitted,
  selectedChoice,
  correctChoice,
  revealMode,
  onChoiceClick,
}: McqChoicesProps) {
  const showCorrectness = submitted && revealMode === 'immediate';

  return (
    <div className="flex flex-col gap-3">
      {choices.map((choice) => {
        const crossed = crossedIds.includes(choice.id);
        const isSelected = selectedChoice === choice.id;
        return (
          <ChoiceButton
            key={choice.id}
            choice={choice}
            crossed={crossed}
            disabled={!crossed && submitted}
            isSelected={isSelected}
            isCorrect={showCorrectness && correctChoice === choice.id}
            isWrongSelection={showCorrectness && isSelected && correctChoice !== choice.id}
            onClick={() => onChoiceClick(choice.id)}
          />
        );
      })}
    </div>
  );
}

interface ChoiceButtonProps {
  choice: Choice;
  crossed: boolean;
  disabled: boolean;
  isSelected: boolean;
  isCorrect: boolean;
  isWrongSelection: boolean;
  onClick: () => void;
}

const HARD_SHADOW = 'shadow-[4px_4px_0_var(--color-ink)]';

/**
 * A crossed choice is NEVER given the `disabled` attribute — it must stay a real,
 * clickable, non-disabled button (with a descriptive aria-label) so restoring it via
 * assistive tech keeps working even after the question has been answered.
 *
 * Every state is a solid block: live choices sit raised on their own hard shadow, answered
 * ones fill with a flat colour, and crossed ones drop flat onto the page. Nothing here
 * relies on colour alone — the crossed state also draws a literal ink rule through the row,
 * which is what keeps it readable for choices whose value is an <img> and so can't be
 * struck through by `line-through`.
 */
function ChoiceButton({ choice, crossed, disabled, isSelected, isCorrect, isWrongSelection, onClick }: ChoiceButtonProps) {
  const surface = crossed
    ? 'bg-merino-dark text-ink-soft'
    : isCorrect
      ? `bg-success text-paper ${HARD_SHADOW}`
      : isWrongSelection
        ? `bg-danger text-paper ${HARD_SHADOW}`
        : isSelected
          ? `bg-venice-blue text-paper ${HARD_SHADOW}`
          : disabled
            ? 'bg-merino text-ink-soft'
            : `bg-paper text-ink hover:bg-merino-dark ${HARD_SHADOW}`;

  const badge =
    crossed || disabled
      ? 'border-ink-soft bg-merino text-ink-soft'
      : isCorrect || isWrongSelection || isSelected
        ? 'border-ink bg-paper text-ink'
        : 'border-ink bg-merino-dark text-ink';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={crossed ? `Restore choice ${choice.id}` : choice.image ? `Choice ${choice.id}` : undefined}
      className={`press relative flex min-h-14 w-full items-center gap-3 border-2 border-ink px-3 py-2.5 text-left disabled:cursor-default ${surface}`}
    >
      <span
        className={`flex h-8 w-8 flex-none items-center justify-center border-2 font-mono text-sm font-bold ${badge}`}
      >
        {choice.id}
      </span>

      {/* The choice's value is content, not chrome, so it reads in the serif like the stem. */}
      <span
        className={`min-w-0 flex-1 prose-reading leading-snug ${crossed ? 'line-through decoration-2' : ''}`}
      >
        {choice.image ? (
          <img
            src={choice.image}
            alt=""
            className="max-h-12 w-auto border-2 border-ink bg-white object-contain object-left"
          />
        ) : (
          choice.text
        )}
      </span>

      {crossed && (
        <>
          {/* Drawn across the whole row (letter badge included) so an image choice still
              reads as eliminated. Stops short of the restore glyph. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-14 left-2 h-0.5 -translate-y-1/2 bg-ink"
          />
          <span
            aria-hidden="true"
            className="relative z-10 flex h-8 w-8 flex-none items-center justify-center border-2 border-ink bg-paper font-mono text-sm leading-none text-ink"
          >
            ↺
          </span>
        </>
      )}
    </button>
  );
}
