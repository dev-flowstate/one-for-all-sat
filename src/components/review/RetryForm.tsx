import { useState } from 'react';
import type { ChoiceId, Question } from '../../types/question';
import type { AttemptOutcome, SessionResult } from '../../types/progress';
import { Button } from '../ui/Button';
import { useProgressStore } from '../../store/useProgressStore';
import { checkMcqAnswer, checkSprAnswer } from '../../lib/scoring/answerChecking';
import { pointsForAnswer } from '../../lib/scoring/points';
import { MathText } from '../math/MathText';
import { GridInInput } from '../test-runner/GridInInput';
import { distinctAnswers } from '../../lib/scoring/answerDisplay';

interface RetryFormProps {
  question: Question;
  onCancel: () => void;
}

function correctAnswerLabel(question: Question): string {
  if (question.type === 'mcq') {
    const correct = question.choices?.find((c) => c.id === question.correctChoice);
    // With an image choice, `text` is only a placeholder — the letter is all we can say here.
    if (correct?.image) return correct.id;
    return correct ? `${correct.id}. ${correct.text}` : (question.correctChoice ?? '—');
  }
  return distinctAnswers(question.acceptableAnswers ?? []).join(' or ') || '—';
}

/** Inline retry UI for a single question: answer it, submit, and commit the outcome to progress. */
export function RetryForm({ question, onCancel }: RetryFormProps) {
  const streak = useProgressStore((s) => s.stats.currentStreak);
  const [selectedChoice, setSelectedChoice] = useState<ChoiceId | undefined>(undefined);
  const [sprInput, setSprInput] = useState('');
  const [showIncorrectFeedback, setShowIncorrectFeedback] = useState(false);

  const hasAnswer = question.type === 'mcq' ? selectedChoice !== undefined : sprInput.trim().length > 0;

  function handleSubmit() {
    const outcome: AttemptOutcome =
      question.type === 'mcq'
        ? checkMcqAnswer(selectedChoice, question.correctChoice)
          ? 'correct'
          : 'incorrect'
        : checkSprAnswer(sprInput, question.acceptableAnswers ?? [])
          ? 'correct'
          : 'incorrect';

    const pointsEarned = pointsForAnswer(question.difficulty, outcome === 'correct', streak);

    const result: SessionResult = {
      completedAt: new Date().toISOString(),
      answers: [
        {
          questionId: question.id,
          outcome,
          selectedChoice: question.type === 'mcq' ? selectedChoice : undefined,
          submittedAnswer: question.type === 'spr' ? sprInput : undefined,
          pointsEarned,
        },
      ],
      totalPoints: pointsEarned,
      correctCount: outcome === 'correct' ? 1 : 0,
      incorrectCount: outcome === 'incorrect' ? 1 : 0,
    };

    // A correct outcome flips this question's status, which drops it out of the Wrong pool
    // (and into Right) on the next render — this card unmounts with it, so no local
    // "correct" state is needed here.
    useProgressStore.getState().applySessionResult(result);
    if (outcome === 'incorrect') {
      setShowIncorrectFeedback(true);
    }
  }

  function handleTryAgain() {
    setSelectedChoice(undefined);
    setSprInput('');
    setShowIncorrectFeedback(false);
  }

  return (
    <div className="mt-3 border-t border-rock-blue/20 pt-3">
      {question.type === 'mcq' ? (
        <div className="grid gap-2">
          {question.choices?.map((choice) => (
            <button
              key={choice.id}
              type="button"
              onClick={() => setSelectedChoice(choice.id)}
              disabled={showIncorrectFeedback}
              aria-label={choice.image ? `Choice ${choice.id}` : undefined}
              className={`flex min-h-11 items-center gap-2.5 border-2 border-ink px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                selectedChoice === choice.id
                  ? 'bg-venice-blue font-semibold text-merino'
                  : 'bg-paper hover:bg-merino-dark'
              }`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center border-2 border-current text-xs font-bold">
                {choice.id}
              </span>
              {choice.image ? (
                <img
                  src={choice.image}
                  alt=""
                  className="max-h-12 w-auto border-2 border-ink bg-white object-contain object-left"
                />
              ) : (
                <span>
                  <MathText text={choice.text} />
                </span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <GridInInput value={sprInput} onChange={setSprInput} disabled={showIncorrectFeedback} />
      )}

      {showIncorrectFeedback && (
        <div className="mt-3 border-2 border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
          Not quite — the correct answer is <span className="font-semibold">{correctAnswerLabel(question)}</span>.
        </div>
      )}

      <div className="mt-3 flex gap-2">
        {showIncorrectFeedback ? (
          <>
            <Button variant="secondary" onClick={handleTryAgain}>
              Try again
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              Close
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" onClick={handleSubmit} disabled={!hasAnswer}>
              Submit answer
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
