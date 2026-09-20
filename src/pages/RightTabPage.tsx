import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProgressStore } from '../store/useProgressStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Tabs } from '../components/ui/Tabs';
import { QuestionReviewCard } from '../components/review/QuestionReviewCard';
import { getWrongPool, getRightPool } from '../lib/pools';

export function RightTabPage() {
  const navigate = useNavigate();
  const questions = useProgressStore((s) => s.questions);
  const progress = useProgressStore((s) => s.progress);
  const resetProgress = useProgressStore((s) => s.resetProgress);
  const isLoaded = useProgressStore((s) => s.isLoaded);

  const rightPool = useMemo(() => getRightPool(questions, progress), [questions, progress]);
  const wrongCount = useMemo(() => getWrongPool(questions, progress).length, [questions, progress]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-venice-blue-dark">Right questions</h1>
          <p className="mt-1 text-venice-blue-dark/70">
            Everything you&apos;ve got correct so far. Send any of them back for more practice.
          </p>
        </div>
        <Link to="/">
          <Button variant="ghost">Home</Button>
        </Link>
      </header>

      <div className="mb-6">
        <Tabs
          items={[
            { id: 'wrong', label: 'Wrong', count: wrongCount },
            { id: 'right', label: 'Right', count: rightPool.length },
          ]}
          activeId="right"
          onChange={(id) => navigate(id === 'wrong' ? '/wrong' : '/right')}
        />
      </div>

      {!isLoaded ? (
        <p className="text-center text-venice-blue-dark/60">Loading your question bank…</p>
      ) : rightPool.length === 0 ? (
        <Card>
          <p className="text-sm text-venice-blue-dark/70">No correct answers yet — go start a practice session.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {rightPool.map((question) => (
            <QuestionReviewCard
              key={question.id}
              question={question}
              actions={
                <Button variant="secondary" onClick={() => resetProgress([question.id])}>
                  Practice again
                </Button>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
