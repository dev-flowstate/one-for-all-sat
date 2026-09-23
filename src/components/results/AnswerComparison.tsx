import type { Question } from '../../types/question';
import type { SessionAnswer } from '../../types/progress';
import { MathText } from '../math/MathText';
import { distinctAnswers } from '../../lib/scoring/answerDisplay';

interface AnswerComparisonProps {
  question: Question;
  answer: SessionAnswer;
}

const LETTER_BASE =
  'flex w-10 flex-none items-center justify-center border-r-2 border-ink font-mono text-sm font-bold';
const TAG_BASE =
  'flex-none border-2 border-ink px-2 py-0.5 font-mono text-[10px] font-semibold tracking-tight text-merino uppercase';

/** Shows what the user answered vs. the correct answer, for a wrong session answer. */
export function AnswerComparison({ question, answer }: AnswerComparisonProps) {
  if (question.type === 'mcq') {
    return (
      <div className="grid gap-2">
        {question.choices?.map((choice) => {
          const isCorrect = choice.id === question.correctChoice;
          const isYourAnswer = choice.id === answer.selectedChoice;
          const rowTone = isCorrect ? 'bg-success-bg' : isYourAnswer ? 'bg-danger-bg' : 'bg-paper';
          const letterTone = isCorrect
            ? 'bg-success text-merino'
            : isYourAnswer
              ? 'bg-danger text-merino'
              : 'bg-merino-dark text-ink';
          return (
            <div key={choice.id} className={`flex items-stretch border-2 border-ink ${rowTone}`}>
              <span className={`${LETTER_BASE} ${letterTone}`}>{choice.id}</span>
              {/* Wraps the verdict tag under the choice text when the row gets narrow. */}
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 px-3 py-2">
                {choice.image ? (
                  <img
                    src={choice.image}
                    alt=""
                    className="max-h-12 w-auto border-2 border-ink bg-white object-contain object-left"
                  />
                ) : (
                  <span className="min-w-0 flex-1 text-sm leading-relaxed">
                    <MathText text={choice.text} />
                  </span>
                )}
                {isCorrect && <span className={`${TAG_BASE} bg-success`}>Correct answer</span>}
                {isYourAnswer && !isCorrect && <span className={`${TAG_BASE} bg-danger`}>Your answer</span>}
              </div>
            </div>
          );
        })}
        {!answer.selectedChoice && (
          <p className="border-2 border-ink bg-merino-dark px-3 py-2 font-mono text-xs">
            You didn&apos;t select an answer.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="border-2 border-ink bg-danger-bg">
        <div className="border-b-2 border-ink bg-danger px-3 py-1 font-mono text-[10px] font-semibold tracking-tight text-merino uppercase">
          Your answer
        </div>
        <p className="px-3 py-2 text-sm font-semibold break-words">{answer.submittedAnswer || '(blank)'}</p>
      </div>
      <div className="border-2 border-ink bg-success-bg">
        <div className="border-b-2 border-ink bg-success px-3 py-1 font-mono text-[10px] font-semibold tracking-tight text-merino uppercase">
          Correct answer
        </div>
        <p className="px-3 py-2 text-sm font-semibold break-words">
          {distinctAnswers(question.acceptableAnswers ?? []).join(' or ') || '—'}
        </p>
      </div>
    </div>
  );
}
