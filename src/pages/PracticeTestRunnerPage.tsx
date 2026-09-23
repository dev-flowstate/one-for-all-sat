import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { Question } from '../types/question';
import { usePracticeTestStore } from '../store/usePracticeTestStore';
import { useProgressStore } from '../store/useProgressStore';
import { useSessionStore } from '../store/useSessionStore';
import { formatClock, moduleTitle } from '../lib/practiceTest/format';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Toggle } from '../components/ui/Toggle';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { TestRunnerLayout } from '../components/test-runner/TestRunnerLayout';
import { CalculatorSplit } from '../components/test-runner/CalculatorSplit';
import { TestQuestion } from '../components/practice-test/TestQuestion';
import { QuestionGrid } from '../components/practice-test/QuestionGrid';
import { ModuleReview } from '../components/practice-test/ModuleReview';
import { BreakScreen } from '../components/practice-test/BreakScreen';

/** The clock turns red for the last five minutes, the point where the real test warns you. */
const WARNING_SECONDS = 5 * 60;

/**
 * Runs the test clock while this page is open. Measured against the wall clock rather than
 * counted in ticks, since a background tab's timers are throttled and would fall behind.
 */
function useTestClock(running: boolean) {
  const tick = usePracticeTestStore((s) => s.tick);
  useEffect(() => {
    if (!running) return;
    let last = Date.now();
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - last) / 1000);
      if (elapsed > 0) {
        last += elapsed * 1000;
        tick(elapsed);
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, tick]);
}

/** A full-length practice test: both modules of each section, the break between them, and a
 *  review page at the end of every module. */
export function PracticeTestRunnerPage() {
  const navigate = useNavigate();
  const test = usePracticeTestStore((s) => s.active);
  const justFinished = usePracticeTestStore((s) => s.justFinished);
  const timedOut = usePracticeTestStore((s) => s.timedOut);
  const { goTo, showReview, toggleMarked, endBreak, dismissTimedOut } = usePracticeTestStore.getState();
  const questions = useProgressStore((s) => s.questions);
  const isLoaded = useProgressStore((s) => s.isLoaded);
  const crosserActive = useSessionStore((s) => s.crosserActive);
  const toggleCrosser = useSessionStore((s) => s.toggleCrosser);

  const [calculatorOpen, setCalculatorOpen] = useState(false);
  /** Which module's navigator is open. Tied to the module, so it closes when time moves it on. */
  const [navigatorFor, setNavigatorFor] = useState<number | null>(null);

  const questionsById = useMemo(() => new Map<string, Question>(questions.map((q) => [q.id, q])), [questions]);

  // Held until the bank has loaded, so a module can't run out and be graded against nothing.
  useTestClock(!!test && isLoaded);

  if (!test) return <Navigate to={justFinished ? `/tests/${justFinished}` : '/tests'} replace />;

  const exit = () => navigate('/tests');

  const timeUpNotice = (
    <ConfirmDialog open={timedOut} title="Time's up" confirmLabel="Continue" onConfirm={dismissTimedOut}>
      <p>The last module ran out of time and was submitted with the answers you had entered.</p>
    </ConfirmDialog>
  );

  if (!isLoaded) {
    return <p className="p-6 font-mono text-sm text-ink-soft">Loading your test…</p>;
  }

  if (test.stage.kind === 'break') {
    return (
      <>
        <BreakScreen secondsLeft={test.secondsLeft} onStartMath={endBreak} onExit={exit} />
        {timeUpNotice}
      </>
    );
  }

  const moduleIndex = test.stage.module;
  const module = test.modules[moduleIndex];
  const ids = module.questionIds;
  const onReview = test.stage.view === 'review';
  const index = test.currentIndex;
  const question = questionsById.get(ids[index]);
  const isMath = module.subject === 'math';
  const lowOnTime = test.secondsLeft <= WARNING_SECONDS;

  return (
    // Same arrangement as a drill: a fixed-height split with the calculator open, an ordinary
    // scrolling page with it closed.
    <div className={calculatorOpen ? 'flex h-[100dvh] flex-col overflow-hidden' : 'min-h-screen pb-24'}>
      <div className="sticky top-0 z-20 flex-none border-b-2 border-ink bg-merino-dark">
        <div className="mx-auto max-w-6xl px-3 py-1.5 sm:px-4 sm:py-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" onClick={exit} className="-ml-1 flex-none">
              Save &amp; exit
            </Button>
            <p className="min-w-0 flex-1 truncate font-mono text-xs font-bold tracking-tight uppercase">
              {moduleTitle(module)}
            </p>
            <p
              role="timer"
              aria-label={`${formatClock(test.secondsLeft)} left in this module`}
              className={`flex-none border-2 border-ink px-2 py-1.5 font-mono text-sm font-bold tabular-nums ${
                lowOnTime ? 'bg-danger text-paper' : 'bg-paper text-ink'
              }`}
            >
              {formatClock(test.secondsLeft)}
            </p>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-2 sm:mt-2">
            {!onReview && question && (
              <Toggle
                active={test.marked.includes(question.id)}
                onToggle={() => toggleMarked(question.id)}
                label="Mark for review"
              />
            )}
            <Toggle active={crosserActive} onToggle={toggleCrosser} label="Answer Eliminator" />
            {isMath && (
              <Toggle active={calculatorOpen} onToggle={() => setCalculatorOpen((v) => !v)} label="Calculator" />
            )}
          </div>
        </div>
      </div>

      <CalculatorSplit calculatorOpen={calculatorOpen} onCloseCalculator={() => setCalculatorOpen(false)}>
        {onReview ? (
          <ModuleReview test={test} moduleIndex={moduleIndex} />
        ) : (
          <TestRunnerLayout>
            <Card title={`Question ${index + 1}`}>
              {question ? (
                <TestQuestion key={question.id} question={question} />
              ) : (
                <p className="text-sm text-ink-soft">This question is no longer in your question bank. Skip it.</p>
              )}
            </Card>
          </TestRunnerLayout>
        )}
      </CalculatorSplit>

      <nav
        aria-label="Question navigation"
        className={`z-20 flex-none border-t-2 border-ink bg-merino-dark ${calculatorOpen ? '' : 'fixed inset-x-0 bottom-0'}`}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2 sm:px-4">
          <Button
            variant="secondary"
            className="flex-none"
            disabled={!onReview && index === 0}
            onClick={() => goTo(onReview ? ids.length - 1 : index - 1)}
          >
            Back
          </Button>
          <div className="flex min-w-0 flex-1 justify-center">
            {onReview ? (
              <p className="font-mono text-xs font-bold tracking-tight uppercase">Check your work</p>
            ) : (
              <Button variant="ghost" onClick={() => setNavigatorFor(moduleIndex)} aria-haspopup="dialog">
                Question {index + 1} of {ids.length} ▴
              </Button>
            )}
          </div>
          {!onReview && (
            <Button
              className="flex-none"
              onClick={() => (index + 1 >= ids.length ? showReview() : goTo(index + 1))}
            >
              Next
            </Button>
          )}
        </div>
      </nav>

      <ConfirmDialog
        open={navigatorFor === moduleIndex}
        title={moduleTitle(module)}
        confirmLabel="Go to review page"
        cancelLabel="Close"
        onConfirm={() => {
          setNavigatorFor(null);
          showReview();
        }}
        onCancel={() => setNavigatorFor(null)}
      >
        <QuestionGrid
          questionIds={ids}
          responses={test.responses}
          marked={test.marked}
          currentIndex={index}
          onSelect={(i) => {
            setNavigatorFor(null);
            goTo(i);
          }}
        />
      </ConfirmDialog>

      {timeUpNotice}
    </div>
  );
}
