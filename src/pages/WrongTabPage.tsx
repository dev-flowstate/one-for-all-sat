import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProgressStore } from '../store/useProgressStore';
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
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <Link
        to="/"
        className="mb-4 inline-block text-xs font-semibold tracking-tight text-venice-blue uppercase hover:underline"
      >
        ← Home
      </Link>
      <header className="mb-5">
        <h1 className="text-2xl leading-none font-bold tracking-tight uppercase sm:text-3xl">Wrong questions</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Everything you&apos;ve missed so far. Retry any of them right here.
        </p>
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
        <p className="panel p-4 text-sm text-ink-soft">Loading your question bank…</p>
      ) : wrongPool.length === 0 ? (
        <div className="panel px-4 py-12 text-center">
          <span
            aria-hidden="true"
            className="inline-flex h-16 w-16 items-center justify-center border-2 border-ink bg-success text-3xl text-paper shadow-[4px_4px_0_var(--color-ink)]"
          >
            ✓
          </span>
          <p className="mt-5 text-sm font-semibold tracking-tight uppercase">All clear</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
            Nothing here — nice work. Missed questions land in this list so you can retry them.
          </p>
          <Link to="/setup" className="mt-5 inline-block">
            <Button variant="primary">Start practicing</Button>
          </Link>
        </div>
      ) : (
        <>
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

          {/* Bulk reset is destructive, so it sits below the list in its own red frame —
              loud enough to read as dangerous, out of the way of the per-item actions. */}
          <div className="mt-8 border-2 border-danger bg-danger-bg shadow-[4px_4px_0_var(--color-danger)]">
            <div className="border-b-2 border-danger bg-danger px-3 py-1.5 text-xs font-semibold tracking-tight text-paper uppercase">
              Danger zone
            </div>
            <div className="p-4">
              <p className="mb-3 text-sm text-ink">
                Clears this whole list at once: every wrong question goes back to unattempted and returns to
                the main pool. This cannot be undone.
              </p>
              <Button variant="danger" onClick={handleResetAll}>
                Reset all wrong
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
