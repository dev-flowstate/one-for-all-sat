import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useSessionStore } from '../store/useSessionStore';
import { useProgressStore } from '../store/useProgressStore';
import { Card } from '../components/ui/Card';
import { TestRunnerToolbar } from '../components/test-runner/TestRunnerToolbar';
import { TestRunnerLayout } from '../components/test-runner/TestRunnerLayout';
import { HighlightableText } from '../components/test-runner/HighlightableText';
import { QuestionPanel } from '../components/test-runner/QuestionPanel';
import { DesmosPanel } from '../components/test-runner/DesmosPanel';

/**
 * The test-taking screen: one question at a time from the active session queue, with
 * Bluebook-style tools (crosser, highlighter, optional Desmos calculator, timer/stopwatch,
 * immediate or end-of-session answer reveal). Reads the active session from
 * useSessionStore — there's no URL param for "which question"; navigation is driven by
 * the store's currentIndex.
 */
export function TestRunnerPage() {
  const navigate = useNavigate();
  const config = useSessionStore((s) => s.config);
  const queue = useSessionStore((s) => s.queue);
  const currentIndex = useSessionStore((s) => s.currentIndex);
  const crosserActive = useSessionStore((s) => s.crosserActive);
  const toggleCrosser = useSessionStore((s) => s.toggleCrosser);
  const goToIndex = useSessionStore((s) => s.goToIndex);

  const [desmosOpen, setDesmosOpen] = useState(false);

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

  if (queue.length === 0 || !config) {
    return <Navigate to="/setup" replace />;
  }

  const question = queue[currentIndex];
  if (!question) {
    return <Navigate to="/setup" replace />;
  }

  const isLast = currentIndex + 1 >= queue.length;

  return (
    <div className="min-h-screen pb-24">
      <TestRunnerToolbar
        currentIndex={currentIndex}
        total={queue.length}
        onExit={handleExit}
        crosserActive={crosserActive}
        onToggleCrosser={toggleCrosser}
        showCalculatorToggle={question.subject === 'math'}
        calculatorOpen={desmosOpen}
        onToggleCalculator={() => setDesmosOpen((v) => !v)}
        timerMode={config.timerMode}
        countdownMinutes={config.countdownMinutes}
        onTimerExpire={finishFlow}
      />

      <TestRunnerLayout
        hasPassage={!!question.passage}
        passage={
          question.passage ? (
            <Card>
              <HighlightableText
                key={question.id}
                text={question.passage}
                rangeKey={`${question.id}:passage`}
                className="text-base leading-relaxed"
              />
            </Card>
          ) : undefined
        }
        question={
          <Card>
            <QuestionPanel
              key={question.id}
              question={question}
              revealMode={config.revealMode}
              isLast={isLast}
              onNext={handleNext}
            />
          </Card>
        }
      />

      <DesmosPanel open={desmosOpen} onClose={() => setDesmosOpen(false)} />
    </div>
  );
}
