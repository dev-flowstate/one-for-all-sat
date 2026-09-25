import { useState } from 'react';
import type { Question, ChoiceId } from '../../types/question';
import type { RevealMode } from '../../types/settings';
import type { AttemptOutcome } from '../../types/progress';
import { useSessionStore } from '../../store/useSessionStore';
import { checkMcqAnswer, checkSprAnswer } from '../../lib/scoring/answerChecking';
import { QuestionLayout } from './QuestionLayout';
import { McqChoices } from './McqChoices';
import { SprInput } from './SprInput';
import { AnswerFeedback } from './AnswerFeedback';
import { Button } from '../ui/Button';

interface QuestionPanelProps {
  question: Question;
  revealMode: RevealMode;
  isLast: boolean;
  onNext: () => void;
  /** Back to the previous question; only when answers can still change. */
  onBack?: () => void;
}

// Stable reference so the Zustand selector below doesn't return a fresh `[]` on every
// render when nothing's crossed out yet — a new array each time makes useSyncExternalStore
// think the snapshot always changed, causing an infinite render loop.
const EMPTY_CHOICE_IDS: ChoiceId[] = [];

/**
 * One drill question, graded the moment it's answered.
 *
 * Mount this keyed by question.id so all local per-question UI state resets on navigation.
 */
export function QuestionPanel({ question, revealMode, isLast, onNext, onBack }: QuestionPanelProps) {
  // Coming back to a question shows the answer entered before.
  const [sprValue, setSprValue] = useState(
    () => useSessionStore.getState().answers[question.id]?.submittedAnswer ?? '',
  );
  const crosserActive = useSessionStore((s) => s.crosserActive);
  const crossedIds = useSessionStore((s) => s.crossedChoices[question.id] ?? EMPTY_CHOICE_IDS);
  const answered = useSessionStore((s) => s.answers[question.id]);
  const answerCurrent = useSessionStore((s) => s.answerCurrent);
  const toggleCrossedChoice = useSessionStore((s) => s.toggleCrossedChoice);
  const submitted = !!answered;
  // Revealed straight away, an answer is final. Revealed at the end, it can change until Next.
  const locked = submitted && revealMode === 'immediate';

  function handleChoiceClick(choiceId: ChoiceId) {
    const crossed = crossedIds.includes(choiceId);
    if (crossed) {
      // Always allowed, even after the question is answered — never locked out.
      toggleCrossedChoice(question.id, choiceId);
      return;
    }
    if (locked) return;
    if (crosserActive) {
      toggleCrossedChoice(question.id, choiceId);
      return;
    }
    const outcome: AttemptOutcome = checkMcqAnswer(choiceId, question.correctChoice) ? 'correct' : 'incorrect';
    answerCurrent(outcome, choiceId);
  }

  function handleSprSubmit() {
    if (locked || !sprValue.trim()) return;
    const outcome: AttemptOutcome = checkSprAnswer(sprValue, question.acceptableAnswers ?? []) ? 'correct' : 'incorrect';
    answerCurrent(outcome, undefined, sprValue);
  }

  return (
    <QuestionLayout question={question}>
      {question.type === 'mcq' ? (
        <McqChoices
          choices={question.choices ?? []}
          crossedIds={crossedIds}
          submitted={locked}
          selectedChoice={answered?.selectedChoice}
          correctChoice={question.correctChoice}
          revealMode={revealMode}
          onChoiceClick={handleChoiceClick}
        />
      ) : (
        <SprInput value={sprValue} onChange={setSprValue} onSubmit={handleSprSubmit} submitted={locked} />
      )}

      {submitted && answered && revealMode === 'immediate' && (
        <div className="mt-5">
          <AnswerFeedback outcome={answered.outcome} explanation={question.explanation} />
        </div>
      )}
      {(onBack || (submitted && answered)) && (
        <div className="mt-5 flex gap-3">
          {onBack && (
            <Button variant="secondary" className="flex-none" onClick={onBack}>
              Back
            </Button>
          )}
          {submitted && answered && (
            <Button className="flex-1" onClick={onNext}>
              {isLast ? 'Finish' : 'Next'}
            </Button>
          )}
        </div>
      )}
    </QuestionLayout>
  );
}
