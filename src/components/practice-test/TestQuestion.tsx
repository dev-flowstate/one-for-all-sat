import type { ChoiceId, Question } from '../../types/question';
import { useSessionStore } from '../../store/useSessionStore';
import { usePracticeTestStore } from '../../store/usePracticeTestStore';
import { QuestionLayout } from '../test-runner/QuestionLayout';
import { McqChoices } from '../test-runner/McqChoices';
import { GridInInput } from '../test-runner/GridInInput';

// A stable empty list, so the selector below doesn't hand back a new array every render.
const EMPTY_CHOICE_IDS: ChoiceId[] = [];

/**
 * One practice-test question. Unlike a drill, nothing is graded here: the answer is only
 * recorded, and can be changed or cleared until the module is submitted.
 *
 * The answer eliminator and highlighter share the drill runner's session state; only the
 * answers themselves belong to the test.
 */
export function TestQuestion({ question }: { question: Question }) {
  const response = usePracticeTestStore((s) => s.active?.responses[question.id]);
  const respond = usePracticeTestStore((s) => s.respond);
  const crosserActive = useSessionStore((s) => s.crosserActive);
  const crossedIds = useSessionStore((s) => s.crossedChoices[question.id] ?? EMPTY_CHOICE_IDS);
  const toggleCrossedChoice = useSessionStore((s) => s.toggleCrossedChoice);

  function handleChoiceClick(choiceId: ChoiceId) {
    const crossed = crossedIds.includes(choiceId);
    if (crossed || crosserActive) {
      // Crossing out the chosen answer takes it back, as on the real test.
      if (!crossed && response?.choice === choiceId) respond(question.id, null);
      toggleCrossedChoice(question.id, choiceId);
      return;
    }
    respond(question.id, { choice: choiceId });
  }

  return (
    <QuestionLayout question={question}>
      {question.type === 'mcq' ? (
        <McqChoices
          choices={question.choices ?? []}
          crossedIds={crossedIds}
          submitted={false}
          selectedChoice={response?.choice}
          revealMode="end"
          onChoiceClick={handleChoiceClick}
        />
      ) : (
        <GridInInput
          value={response?.text ?? ''}
          onChange={(value) => respond(question.id, value ? { text: value } : null)}
        />
      )}
    </QuestionLayout>
  );
}
