import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProgressStore } from '../store/useProgressStore';
import { Button } from '../components/ui/Button';
import { Tabs } from '../components/ui/Tabs';
import { QuestionReviewCard } from '../components/review/QuestionReviewCard';
import { getWrongPool, getRightPool } from '../lib/pools';
import { useLoadedQuestions } from '../lib/useLoadedQuestions';
import { QuestionPlaceholder } from '../components/review/QuestionPlaceholder';

/** How many right questions are shown at first, and added each time the list nears its end. */
const PAGE = 20;

export function RightTabPage() {
  const navigate = useNavigate();
  const questions = useProgressStore((s) => s.questions);
  const progress = useProgressStore((s) => s.progress);
  const resetProgress = useProgressStore((s) => s.resetProgress);
  const isLoaded = useProgressStore((s) => s.isLoaded);

  const rightPool = useMemo(() => getRightPool(questions, progress), [questions, progress]);
  const wrongCount = useMemo(() => getWrongPool(questions, progress).length, [questions, progress]);

  // Right questions can run to hundreds, each with its text and images, so they're loaded a page
  // at a time as the list is scrolled rather than all on opening the tab.
  const [shown, setShown] = useState(PAGE);
  const visible = useMemo(() => rightPool.slice(0, shown), [rightPool, shown]);
  const visibleIds = useMemo(() => visible.map((q) => q.id), [visible]);
  const { loaded, ready } = useLoadedQuestions(visibleIds);
  const sentinel = useRef<HTMLDivElement>(null);
  const more = ready && shown < rightPool.length;

  useEffect(() => {
    const target = sentinel.current;
    if (!target || !more) return;
    // Starts loading a screen before the end is reached, so scrolling rarely meets a placeholder.
    const observer = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && setShown((n) => n + PAGE),
      { rootMargin: '100% 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [more]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <Link
        to="/"
        className="mb-4 inline-block text-xs font-semibold tracking-tight text-venice-blue uppercase hover:underline"
      >
        ← Home
      </Link>
      <header className="mb-5">
        <h1 className="text-2xl leading-none font-bold tracking-tight uppercase sm:text-3xl">Right questions</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Everything you&apos;ve got correct so far. Send any of them back for more practice.
        </p>
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
        <p className="panel p-4 text-sm text-ink-soft">Loading your question bank…</p>
      ) : rightPool.length === 0 ? (
        <div className="panel px-4 py-12 text-center">
          <span
            aria-hidden="true"
            className="inline-flex h-16 w-16 items-center justify-center border-2 border-ink bg-rock-blue text-3xl font-bold text-ink tabular-nums shadow-[4px_4px_0_var(--color-ink)]"
          >
            0
          </span>
          <p className="mt-5 text-sm font-semibold tracking-tight uppercase">Nothing banked yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
            Every question you answer correctly collects here, ready to send back for more practice.
          </p>
          <Link to="/setup" className="mt-5 inline-block">
            <Button variant="primary">Start practicing</Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map(({ id }) => {
            const question = loaded[id];
            if (!question) return <QuestionPlaceholder key={id} />;
            return (
              <QuestionReviewCard
                key={id}
                question={question}
                actions={
                  <Button variant="secondary" onClick={() => resetProgress([id])}>
                    Practice again
                  </Button>
                }
              />
            );
          })}
          {more && <div ref={sentinel} aria-hidden="true" className="h-px" />}
        </div>
      )}
    </div>
  );
}
