import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Question } from '../../types/question';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Toggle } from '../ui/Toggle';

const DIFFICULTY_TONE: Record<Question['difficulty'], 'success' | 'accent' | 'danger'> = {
  Easy: 'success',
  Medium: 'accent',
  Hard: 'danger',
};

interface QuestionReviewCardProps {
  question: Question;
  /** Small controls rendered top-right, e.g. Retry / Reset / Practice again. */
  actions?: ReactNode;
  /** "Your answer vs correct answer" block, rendered above the explanation toggle. */
  answerSummary?: ReactNode;
  /** Extra expandable content below the explanation, e.g. an inline retry form. */
  children?: ReactNode;
}

/** Shared review card: badges, passage/prompt/images, and a "Show explanation" toggle. */
export function QuestionReviewCard({ question, actions, answerSummary, children }: QuestionReviewCardProps) {
  const [showExplanation, setShowExplanation] = useState(false);

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{question.domain}</Badge>
          <Badge>{question.skill}</Badge>
          <Badge tone={DIFFICULTY_TONE[question.difficulty]}>{question.difficulty}</Badge>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {question.passage && (
        <div className="mb-3 whitespace-pre-wrap rounded-lg bg-merino-dark/50 p-3 text-sm leading-relaxed">
          {question.passage}
        </div>
      )}

      {question.images && question.images.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          {question.images.map((img, i) => (
            <img
              key={i}
              src={img.src}
              alt={img.alt ?? ''}
              className="max-w-full rounded-lg border border-rock-blue/30"
            />
          ))}
        </div>
      )}

      <p className="mb-3 whitespace-pre-wrap font-medium">{question.prompt}</p>

      {answerSummary}

      <div className="mt-3">
        <Toggle
          active={showExplanation}
          onToggle={() => setShowExplanation((v) => !v)}
          label={showExplanation ? 'Hide explanation' : 'Show explanation'}
        />
        {showExplanation && (
          <div className="mt-2 whitespace-pre-wrap rounded-lg border border-venice-blue/20 bg-venice-blue/5 p-3 text-sm leading-relaxed">
            {question.explanation}
          </div>
        )}
      </div>

      {children}
    </Card>
  );
}
