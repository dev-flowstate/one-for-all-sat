import type { Question } from '../../types/question';
import type { SessionAnswer } from '../../types/progress';

interface AnswerComparisonProps {
  question: Question;
  answer: SessionAnswer;
}

/** Shows what the user answered vs. the correct answer, for a wrong session answer. */
export function AnswerComparison({ question, answer }: AnswerComparisonProps) {
  if (question.type === 'mcq') {
    return (
      <div className="mb-3 grid gap-2">
        {question.choices?.map((choice) => {
          const isCorrect = choice.id === question.correctChoice;
          const isYourAnswer = choice.id === answer.selectedChoice;
          return (
            <div
              key={choice.id}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                isCorrect
                  ? 'border-success/40 bg-success-bg text-success'
                  : isYourAnswer
                    ? 'border-danger/40 bg-danger-bg text-danger'
                    : 'border-rock-blue/30'
              }`}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-xs">
                {choice.id}
              </span>
              <span className="flex-1">
                {choice.image ? (
                  <img src={choice.image} alt="" className="max-h-12 w-auto rounded object-contain object-left" />
                ) : (
                  choice.text
                )}
              </span>
              {isCorrect && <span className="shrink-0 text-xs font-semibold">Correct answer</span>}
              {isYourAnswer && !isCorrect && <span className="shrink-0 text-xs font-semibold">Your answer</span>}
            </div>
          );
        })}
        {!answer.selectedChoice && <p className="text-xs text-venice-blue-dark/60">You didn&apos;t select an answer.</p>}
      </div>
    );
  }

  return (
    <div className="mb-3 flex flex-col gap-2 text-sm">
      <div className="rounded-lg border border-danger/40 bg-danger-bg px-3 py-2 text-danger">
        Your answer: <span className="font-semibold">{answer.submittedAnswer || '(blank)'}</span>
      </div>
      <div className="rounded-lg border border-success/40 bg-success-bg px-3 py-2 text-success">
        Correct answer:{' '}
        <span className="font-semibold">{(question.acceptableAnswers ?? []).join(' or ') || '—'}</span>
      </div>
    </div>
  );
}
