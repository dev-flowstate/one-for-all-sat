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
export function QuestionPanel({ question, revealMode, isLast, onNext }: QuestionPanelProps) {
  const [sprValue, setSprValue] = useState('');
  const crosserActive = useSessionStore((s) => s.crosserActive);
  const crossedIds = useSessionStore((s) => s.crossedChoices[question.id] ?? EMPTY_CHOICE_IDS);
  const answered = useSessionStore((s) => s.answers[question.id]);
  const answerCurrent = useSessionStore((s) => s.answerCurrent);
  const toggleCrossedChoice = useSessionStore((s) => s.toggleCrossedChoice);
  const submitted = !!answered;

  function handleChoiceClick(choiceId: ChoiceId) {
    const crossed = crossedIds.includes(choiceId);
    if (crossed) {
      // Always allowed, even after the question is answered — never locked out.
      toggleCrossedChoice(question.id, choiceId);
      return;
    }
    if (submitted) return;
    if (crosserActive) {
      toggleCrossedChoice(question.id, choiceId);
      return;
    }
    const outcome: AttemptOutcome = checkMcqAnswer(choiceId, question.correctChoice) ? 'correct' : 'incorrect';
    answerCurrent(outcome, choiceId);
  }

  function handleSprSubmit() {
    if (submitted || !sprValue.trim()) return;
    const outcome: AttemptOutcome = checkSprAnswer(sprValue, question.acceptableAnswers ?? []) ? 'correct' : 'incorrect';
    answerCurrent(outcome, undefined, sprValue);
  }

  return (
    <QuestionLayout question={question}>
      {question.type === 'mcq' ? (
        <McqChoices
          choices={question.choices ?? []}
          crossedIds={crossedIds}
          submitted={submitted}
          selectedChoice={answered?.selectedChoice}
          correctChoice={question.correctChoice}
          revealMode={revealMode}
          onChoiceClick={handleChoiceClick}
        />
      ) : (
        <SprInput value={sprValue} onChange={setSprValue} onSubmit={handleSprSubmit} submitted={submitted} />
      )}

      {submitted && answered && (
        <div className="mt-5">
          {revealMode === 'immediate' && <AnswerFeedback outcome={answered.outcome} explanation={question.explanation} />}
          <Button className="mt-4 w-full" onClick={onNext}>
            {isLast ? 'Finish' : 'Next'}
          </Button>
        </div>
      )}
    </QuestionLayout>
  );
}
