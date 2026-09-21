import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import type { Question } from '../types/question';
import { useSessionStore } from '../store/useSessionStore';
import { useProgressStore } from '../store/useProgressStore';
import { Button } from '../components/ui/Button';
import { Toggle } from '../components/ui/Toggle';
import { QuestionReviewCard } from '../components/review/QuestionReviewCard';
import { AnswerComparison } from '../components/results/AnswerComparison';

/** The headline verdict: a solid block of colour is the whole point of the score panel. */
function verdictFor(accuracy: number): { label: string; tone: string } {
  if (accuracy === 100) return { label: 'Flawless', tone: 'bg-success text-paper' };
  if (accuracy >= 60) return { label: 'Solid round', tone: 'bg-venice-blue text-merino' };
  return { label: 'Keep going', tone: 'bg-rock-blue text-ink' };
}

export function ResultsPage() {
  const lastResult = useSessionStore((s) => s.lastResult);
  const questions = useProgressStore((s) => s.questions);
  const [showCorrect, setShowCorrect] = useState(false);

  const questionsById = useMemo(() => {
    const map = new Map<string, Question>();
    for (const q of questions) map.set(q.id, q);
    return map;
  }, [questions]);

  if (!lastResult) return <Navigate to="/" replace />;

  const totalAnswered = lastResult.correctCount + lastResult.incorrectCount;
  const wrongAnswers = lastResult.answers.filter((a) => a.outcome === 'incorrect');
  const correctAnswers = lastResult.answers.filter((a) => a.outcome === 'correct');
  const accuracy = totalAnswered > 0 ? Math.round((lastResult.correctCount / totalAnswered) * 100) : 0;
  const verdict = verdictFor(accuracy);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      {/* The payoff panel: the score is deliberately the largest thing on the page. */}
      <header className="panel-raised">
        <div className="flex items-center gap-2 border-b-2 border-ink bg-ink px-3 py-1.5">
          <span aria-hidden="true" className="flex gap-1">
            <span className="block h-2.5 w-2.5 border-2 border-merino" />
            <span className="block h-2.5 w-2.5 border-2 border-merino" />
          </span>
          <span className="flex-1 truncate text-[11px] font-semibold tracking-tight text-merino uppercase">
            Session results
          </span>
          <span className="text-[11px] font-semibold tracking-tight text-merino uppercase tabular-nums">
            {totalAnswered} answered
          </span>
        </div>

        <div className="border-b-2 border-ink px-4 py-8 text-center sm:py-12">
          <p className="text-[11px] font-semibold tracking-tight text-ink-soft uppercase">You scored</p>
          <p className="mt-2 flex items-baseline justify-center gap-2 leading-none">
            <span className="text-6xl font-bold tracking-tight tabular-nums sm:text-8xl">
              {lastResult.correctCount}
            </span>
            <span className="text-2xl font-bold tracking-tight text-ink-soft tabular-nums sm:text-4xl">
              / {totalAnswered}
            </span>
          </p>
          <p
            className={`mt-5 inline-block border-2 border-ink px-3 py-1 text-xs font-semibold tracking-tight uppercase tabular-nums ${verdict.tone}`}
          >
            {accuracy}% · {verdict.label}
          </p>
        </div>

        {/* 2px gaps over an ink background draw the rules, so the cells stay aligned. */}
        <dl className="grid grid-cols-3 gap-[2px] bg-ink">
          <div className="bg-merino-dark px-3 py-2.5 text-center">
            <dt className="text-[10px] font-semibold tracking-tight text-ink-soft uppercase">Correct</dt>
            <dd className="text-xl font-bold tabular-nums sm:text-2xl">{lastResult.correctCount}</dd>
          </div>
          <div className="bg-merino-dark px-3 py-2.5 text-center">
            <dt className="text-[10px] font-semibold tracking-tight text-ink-soft uppercase">Missed</dt>
            <dd className="text-xl font-bold tabular-nums sm:text-2xl">{lastResult.incorrectCount}</dd>
          </div>
          <div className="bg-merino-dark px-3 py-2.5 text-center">
            <dt className="text-[10px] font-semibold tracking-tight text-ink-soft uppercase">Points</dt>
            <dd className="text-xl font-bold tabular-nums sm:text-2xl">{lastResult.totalPoints}</dd>
          </div>
        </dl>
      </header>

      <div className="mt-5 sm:mt-6">
        <Link to="/setup" className="block">
          <Button variant="primary" className="w-full py-4 text-base sm:py-5 sm:text-lg">
            Practice again
          </Button>
        </Link>
        <Link to="/" className="mt-3 block">
          <Button variant="ghost" className="w-full">
            Back to home
          </Button>
        </Link>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-2 border-2 border-ink bg-ink px-3 py-1.5">
          <h2 className="text-xs font-semibold tracking-tight text-merino uppercase">Questions to review</h2>
          <span className="text-xs font-semibold text-merino tabular-nums">[{wrongAnswers.length}]</span>
        </div>

        {wrongAnswers.length === 0 ? (
          <div className="panel px-4 py-10 text-center">
            <span
              aria-hidden="true"
              className="inline-flex h-16 w-16 items-center justify-center border-2 border-ink bg-success text-3xl text-paper shadow-[4px_4px_0_var(--color-ink)]"
            >
              ✓
            </span>
            <p className="mt-5 text-sm font-semibold tracking-tight uppercase">Perfect session</p>
            <p className="mt-2 text-sm text-ink-soft">Nothing wrong to review.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {wrongAnswers.map((answer) => {
              const question = questionsById.get(answer.questionId);
              if (!question) return null;
              return (
                <QuestionReviewCard
                  key={answer.questionId}
                  question={question}
                  answerSummary={<AnswerComparison question={question} answer={answer} />}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Secondary by design: a quiet switch, not a section of its own. */}
      {correctAnswers.length > 0 && (
        <section className="mt-8">
          <Toggle
            active={showCorrect}
            onToggle={() => setShowCorrect((v) => !v)}
            label={`${showCorrect ? 'Hide' : 'Show'} correct answers [${correctAnswers.length}]`}
          />
          {showCorrect && (
            <div className="mt-4 flex flex-col gap-4">
              {correctAnswers.map((answer) => {
                const question = questionsById.get(answer.questionId);
                if (!question) return null;
                return <QuestionReviewCard key={answer.questionId} question={question} />;
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
