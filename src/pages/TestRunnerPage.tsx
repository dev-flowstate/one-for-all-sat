import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useSessionStore } from '../store/useSessionStore';
import { useProgressStore } from '../store/useProgressStore';
import { Card } from '../components/ui/Card';
import { TestRunnerToolbar } from '../components/test-runner/TestRunnerToolbar';
import { TestRunnerLayout } from '../components/test-runner/TestRunnerLayout';
import { QuestionPanel } from '../components/test-runner/QuestionPanel';
import { CalculatorPanel } from '../components/test-runner/CalculatorPanel';
import { SplitDivider } from '../components/test-runner/SplitDivider';

/** Side-by-side above this, stacked below — the same 1024px pivot the question grid uses. */
const WIDE_QUERY = '(min-width: 1024px)';

function useIsWide(): boolean {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY);
    const update = (event: MediaQueryListEvent) => setWide(event.matches);
    query.addEventListener('change', update);
    setWide(query.matches);
    return () => query.removeEventListener('change', update);
  }, []);
  return wide;
}

/**
 * The test-taking screen: one question at a time from the active session queue, with
 * Bluebook-style tools (crosser, highlighter, optional graphing calculator, timer/stopwatch,
 * immediate or end-of-session answer reveal). Reads the active session from
 * useSessionStore — there's no URL param for "which question"; navigation is driven by
 * the store's currentIndex.
 */
export function TestRunnerPage() {
  const navigate = useNavigate();
  const config = useSessionStore((s) => s.config);
  const queue = useSessionStore((s) => s.queue);
  const lastResult = useSessionStore((s) => s.lastResult);
  const currentIndex = useSessionStore((s) => s.currentIndex);
  const crosserActive = useSessionStore((s) => s.crosserActive);
  const toggleCrosser = useSessionStore((s) => s.toggleCrosser);
  const goToIndex = useSessionStore((s) => s.goToIndex);

  const [calculatorOpen, setCalculatorOpen] = useState(false);
  /** Percentage of the split given to the question. Above half, because the question is what
   *  you're actually answering — the calculator is the aid. */
  const [questionShare, setQuestionShare] = useState(55);
  const splitRef = useRef<HTMLDivElement>(null);
  const isWide = useIsWide();

  function finishFlow() {
    const result = useSessionStore.getState().finishSession();
    useProgressStore.getState().applySessionResult(result);
    useSessionStore.getState().clearSession();
    navigate('/results');
  }

  /** Abandons the session without calling applySessionResult, so answered questions stay
   *  unattempted in the main pool. */
  function handleExit() {
    const hasAnswers = Object.keys(useSessionStore.getState().answers).length > 0;
    if (hasAnswers && !window.confirm('Exit this session? Your answers so far will be discarded.')) {
      return;
    }
    useSessionStore.getState().clearSession();
    navigate('/');
  }

  function handleNext() {
    if (currentIndex + 1 >= queue.length) {
      finishFlow();
    } else {
      goToIndex(currentIndex + 1);
    }
  }

  // finishFlow clears the session before navigating, so this guard re-runs with an empty
  // queue and would otherwise bounce to /setup, beating navigate('/results') and eating the
  // results screen entirely. A just-finished session has a lastResult, so send those there.
  const fallback = lastResult ? '/results' : '/setup';

  if (queue.length === 0 || !config) {
    return <Navigate to={fallback} replace />;
  }

  const question = queue[currentIndex];
  if (!question) {
    return <Navigate to={fallback} replace />;
  }

  const isLast = currentIndex + 1 >= queue.length;

  return (
    // With the calculator open the page becomes a fixed-height split and each pane scrolls
    // itself; closed, it goes back to being an ordinary scrolling document.
    <div className={calculatorOpen ? 'flex h-[100dvh] flex-col overflow-hidden' : 'min-h-screen pb-24'}>
      <TestRunnerToolbar
        currentIndex={currentIndex}
        total={queue.length}
        onExit={handleExit}
        crosserActive={crosserActive}
        onToggleCrosser={toggleCrosser}
        showCalculatorToggle={question.subject === 'math'}
        calculatorOpen={calculatorOpen}
        onToggleCalculator={() => setCalculatorOpen((v) => !v)}
        timerMode={config.timerMode}
        countdownMinutes={config.countdownMinutes}
        onTimerExpire={finishFlow}
      />

      <div ref={splitRef} className={calculatorOpen ? 'flex min-h-0 flex-1 flex-col lg:flex-row' : ''}>
        <div
          className={calculatorOpen ? 'min-h-0 overflow-y-auto' : ''}
          style={calculatorOpen ? { flexBasis: `${questionShare}%`, flexGrow: 0, flexShrink: 0 } : undefined}
        >
          <TestRunnerLayout>
            <Card title="Question">
              <QuestionPanel
                key={question.id}
                question={question}
                revealMode={config.revealMode}
                isLast={isLast}
                onNext={handleNext}
              />
            </Card>
          </TestRunnerLayout>
        </div>

        {calculatorOpen && (
          <SplitDivider
            containerRef={splitRef}
            horizontal={isWide}
            value={questionShare}
            onChange={setQuestionShare}
          />
        )}

        {/* Hidden rather than unmounted, so closing the calculator doesn't wipe what's
            typed into it. */}
        <div className={calculatorOpen ? 'min-h-0 flex-1' : 'hidden'}>
          <CalculatorPanel open={calculatorOpen} onClose={() => setCalculatorOpen(false)} />
        </div>
      </div>
    </div>
  );
}
