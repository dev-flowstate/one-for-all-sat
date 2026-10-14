import { useEffect, useRef } from 'react';
import type { AttemptOutcome } from '../../types/progress';
import { sparkFrom } from '../../lib/sparks';
import { MathText } from '../math/MathText';
import { StepByStepButton } from '../solution/StepByStep';

interface AnswerFeedbackProps {
  outcome: AttemptOutcome;
  explanation: string;
  questionId: string;
}

/**
 * Immediate-reveal-mode feedback shown right after a question is answered: a solid
 * verdict bar over the explanation, rather than a tinted wash. The glyph carries the
 * verdict alongside the colour, and the explanation is long-form so it reads in the serif.
 */
export function AnswerFeedback({ outcome, explanation, questionId }: AnswerFeedbackProps) {
  const correct = outcome === 'correct';
  const bar = useRef<HTMLParagraphElement>(null);
  // A bigger, brighter burst over the verdict bar when the answer is right.
  useEffect(() => {
    if (correct && bar.current)
      sparkFrom(bar.current, {
        colors: ['--color-success', '--color-caution', '--color-venice-blue'],
        count: 12,
        radius: 60,
        size: 16,
        width: 4,
        durationMs: 650,
      });
  }, [correct]);
  return (
    <div className="border-2 border-ink shadow-[4px_4px_0_var(--color-ink)]">
      <p
        ref={bar}
        className={`flex items-center gap-2 border-b-2 border-ink px-3 py-2 font-mono text-xs font-bold tracking-tight uppercase text-paper ${
          correct ? 'bg-success' : 'bg-danger'
        }`}
      >
        <span aria-hidden="true">{correct ? '✓' : '✕'}</span>
        {correct ? 'Correct' : 'Incorrect'}
      </p>
      <div className="bg-paper px-3 py-3">
        <div className="mb-3">
          <StepByStepButton questionId={questionId} />
        </div>
        <p className="prose-reading max-w-[68ch] whitespace-pre-wrap">
          <MathText text={explanation} />
        </p>
      </div>
    </div>
  );
}
