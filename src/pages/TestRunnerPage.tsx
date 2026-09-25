import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useSessionStore } from '../store/useSessionStore';
import { Card } from '../components/ui/Card';
import { TestRunnerToolbar } from '../components/test-runner/TestRunnerToolbar';
import { TestRunnerLayout } from '../components/test-runner/TestRunnerLayout';
import { QuestionPanel } from '../components/test-runner/QuestionPanel';
import { CalculatorSplit } from '../components/test-runner/CalculatorSplit';

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
  const highlighterActive = useSessionStore((s) => s.highlighterActive);
  const toggleHighlighter = useSessionStore((s) => s.toggleHighlighter);
  const goToIndex = useSessionStore((s) => s.goToIndex);

  const [calculatorOpen, setCalculatorOpen] = useState(false);
  /** Set when leaving for home on purpose. Navigating is applied after the session is cleared,
   *  and without this the empty session would bounce the page to the last results instead. */
  const [leaving, setLeaving] = useState(false);

  // An answer that can still change is only saved on moving on; closing or reloading the page
  // is moving on too.
  useEffect(() => {
    const save = () => useSessionStore.getState().commitPending();
    window.addEventListener('pagehide', save);
    return () => window.removeEventListener('pagehide', save);
  }, []);

  function finishFlow() {
    useSessionStore.getState().finishSession();
    useSessionStore.getState().clearSession();
    navigate('/results');
  }

  /** Ends the set early. Answers are saved as they're given, so leaving keeps them; with any
   *  answered, it ends on the results for those, like finishing does. */
  function handleExit() {
    const answered = Object.keys(useSessionStore.getState().answers).length;
    if (answered === 0) {
      setLeaving(true);
      useSessionStore.getState().clearSession();
      navigate('/');
      return;
    }
    const kept = answered === 1 ? 'The question you answered is' : `The ${answered} questions you answered are`;
    if (window.confirm(`End this practice now? ${kept} saved; the rest stay unattempted.`)) finishFlow();
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
    return leaving ? null : <Navigate to={fallback} replace />;
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
        highlighterActive={highlighterActive}
        onToggleHighlighter={toggleHighlighter}
        showCalculatorToggle={question.subject === 'math'}
        calculatorOpen={calculatorOpen}
        onToggleCalculator={() => setCalculatorOpen((v) => !v)}
        timerMode={config.timerMode}
        countdownMinutes={config.countdownMinutes}
        onTimerExpire={finishFlow}
      />

      <CalculatorSplit calculatorOpen={calculatorOpen} onCloseCalculator={() => setCalculatorOpen(false)}>
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
      </CalculatorSplit>
    </div>
  );
}
