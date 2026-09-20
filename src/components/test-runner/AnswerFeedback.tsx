import type { AttemptOutcome } from '../../types/progress';

interface AnswerFeedbackProps {
  outcome: AttemptOutcome;
  explanation: string;
}

/** Immediate-reveal-mode feedback banner shown right after a question is answered. */
export function AnswerFeedback({ outcome, explanation }: AnswerFeedbackProps) {
  const correct = outcome === 'correct';
  return (
    <div className={`rounded-lg p-4 text-sm ${correct ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'}`}>
      <p className="font-semibold">{correct ? 'Correct' : 'Incorrect'}</p>
      <p className="mt-1 whitespace-pre-wrap">{explanation}</p>
    </div>
  );
}
