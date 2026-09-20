import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import type { Question } from '../types/question';
import { useSessionStore } from '../store/useSessionStore';
import { useProgressStore } from '../store/useProgressStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { QuestionReviewCard } from '../components/review/QuestionReviewCard';
import { AnswerComparison } from '../components/results/AnswerComparison';

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-venice-blue-dark">Session results</h1>
        <p className="mt-2 text-venice-blue-dark/70">Here&apos;s how you did.</p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 text-center">
        <Card>
          <p className="text-2xl font-bold text-venice-blue">
            {lastResult.correctCount} / {totalAnswered}
          </p>
          <p className="text-xs text-venice-blue-dark/70">Correct</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-venice-blue">{lastResult.totalPoints}</p>
          <p className="text-xs text-venice-blue-dark/70">Points earned</p>
        </Card>
      </div>

      <div className="mb-8 flex flex-col gap-3 sm:flex-row">
        <Link to="/" className="flex-1">
          <Button className="w-full" variant="secondary">
            Back to home
          </Button>
        </Link>
        <Link to="/setup" className="flex-1">
          <Button className="w-full" variant="primary">
            Practice again
          </Button>
        </Link>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-venice-blue-dark">
          Questions to review ({wrongAnswers.length})
        </h2>
        {wrongAnswers.length === 0 ? (
          <Card>
            <p className="text-sm text-venice-blue-dark/70">Perfect session — nothing wrong to review.</p>
          </Card>
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

      {correctAnswers.length > 0 && (
        <section>
          <Button variant="ghost" onClick={() => setShowCorrect((v) => !v)}>
            {showCorrect ? 'Hide' : 'Show'} correct answers ({correctAnswers.length})
          </Button>
          {showCorrect && (
            <div className="mt-3 flex flex-col gap-4">
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
