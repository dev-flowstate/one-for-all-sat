import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProgressStore } from '../store/useProgressStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Tabs } from '../components/ui/Tabs';
import { QuestionReviewCard } from '../components/review/QuestionReviewCard';
import { RetryForm } from '../components/review/RetryForm';
import { getWrongPool, getRightPool } from '../lib/pools';

export function WrongTabPage() {
  const navigate = useNavigate();
  const questions = useProgressStore((s) => s.questions);
  const progress = useProgressStore((s) => s.progress);
  const resetProgress = useProgressStore((s) => s.resetProgress);
  const isLoaded = useProgressStore((s) => s.isLoaded);

  const wrongPool = useMemo(() => getWrongPool(questions, progress), [questions, progress]);
  const rightCount = useMemo(() => getRightPool(questions, progress).length, [questions, progress]);

  const [retryingId, setRetryingId] = useState<string | null>(null);

  function handleResetAll() {
    if (wrongPool.length === 0) return;
    const confirmed = window.confirm(
      `Reset all ${wrongPool.length} wrong question${wrongPool.length === 1 ? '' : 's'} to unattempted?`,
    );
    if (confirmed) {
      resetProgress(wrongPool.map((q) => q.id));
      setRetryingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-venice-blue-dark">Wrong questions</h1>
          <p className="mt-1 text-venice-blue-dark/70">Everything you&apos;ve missed so far. Retry any of them right here.</p>
        </div>
        <Link to="/">
          <Button variant="ghost">Home</Button>
        </Link>
      </header>

      <div className="mb-6">
        <Tabs
          items={[
            { id: 'wrong', label: 'Wrong', count: wrongPool.length },
            { id: 'right', label: 'Right', count: rightCount },
          ]}
          activeId="wrong"
          onChange={(id) => navigate(id === 'right' ? '/right' : '/wrong')}
        />
      </div>

      {!isLoaded ? (
        <p className="text-center text-venice-blue-dark/60">Loading your question bank…</p>
      ) : wrongPool.length === 0 ? (
        <Card>
          <p className="text-sm text-venice-blue-dark/70">Nothing here — nice work.</p>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex justify-end">
            <Button variant="danger" onClick={handleResetAll}>
              Reset all wrong to unattempted
            </Button>
          </div>

          <div className="flex flex-col gap-4">
            {wrongPool.map((question) => (
              <QuestionReviewCard
                key={question.id}
                question={question}
                actions={
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => setRetryingId((id) => (id === question.id ? null : question.id))}
                    >
                      {retryingId === question.id ? 'Hide retry' : 'Retry'}
                    </Button>
                    <Button variant="ghost" onClick={() => resetProgress([question.id])}>
                      Reset
                    </Button>
                  </>
                }
              >
                {retryingId === question.id && <RetryForm question={question} onCancel={() => setRetryingId(null)} />}
              </QuestionReviewCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
