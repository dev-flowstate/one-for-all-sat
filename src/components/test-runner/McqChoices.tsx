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

/**
 * A crossed choice is NEVER given the `disabled` attribute — it must stay a real,
 * clickable, non-disabled button (with a descriptive aria-label) so restoring it via
 * assistive tech keeps working even after the question has been answered.
 */
function ChoiceButton({ choice, crossed, disabled, isSelected, isCorrect, isWrongSelection, onClick }: ChoiceButtonProps) {
  const stateClasses = crossed
    ? 'border-rock-blue/40 bg-white/50 text-venice-blue-dark opacity-50'
    : isCorrect
      ? 'border-success bg-success-bg text-success'
      : isWrongSelection
        ? 'border-danger bg-danger-bg text-danger'
        : isSelected
          ? 'border-venice-blue bg-venice-blue/10 text-venice-blue-dark'
          : 'border-rock-blue/40 bg-white/60 text-venice-blue-dark hover:border-venice-blue/60 hover:bg-venice-blue/5';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={crossed ? `Restore choice ${choice.id}` : choice.image ? `Choice ${choice.id}` : undefined}
      className={`flex min-h-11 w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors disabled:cursor-default disabled:opacity-70 ${stateClasses}`}
    >
      <span
        className={`flex h-7 w-7 flex-none items-center justify-center rounded-full border text-xs font-bold ${
          crossed ? 'border-venice-blue-dark/30' : 'border-current'
        }`}
      >
        {choice.id}
      </span>
      <span className={`flex-1 ${crossed ? 'line-through' : ''}`}>
        {choice.image ? (
          <img src={choice.image} alt="" className="max-h-12 w-auto rounded object-contain object-left" />
        ) : (
          choice.text
        )}
      </span>
      {crossed && (
        <span aria-hidden="true" className="flex-none text-lg leading-none">
          ↺
        </span>
      )}
    </button>
  );
}
