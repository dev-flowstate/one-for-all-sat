import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Question } from '../../types/question';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Toggle } from '../ui/Toggle';
import { MathText } from '../math/MathText';
import { renderHighlighted } from '../../lib/highlighter/renderHighlighted';

/** Difficulty keeps its semantics (Easy/Medium/Hard) but reads as a solid block, not a tint. */
const DIFFICULTY_CLASSES: Record<Question['difficulty'], string> = {
  Easy: 'bg-success text-merino',
  Medium: 'bg-venice-blue text-merino',
  Hard: 'bg-danger text-merino',
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
      {/* Full-bleed meta strip: pulled out to the panel edges so it reads as card chrome
          rather than as content. `min-w-0` lets a long skill label wrap inside its badge. */}
      <div className="-mx-4 -mt-4 mb-4 flex flex-wrap items-start justify-between gap-3 border-b-2 border-ink bg-merino px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Badge>{question.domain}</Badge>
          <Badge>{question.skill}</Badge>
          <span
            className={`inline-flex flex-none items-center border-2 border-ink px-2 py-0.5 font-mono text-[11px] font-semibold tracking-tight uppercase ${DIFFICULTY_CLASSES[question.difficulty]}`}
          >
            {question.difficulty}
          </span>
        </div>
        {actions && <div className="flex flex-none flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {question.passage && (
        <div className="mb-4 border-2 border-ink bg-merino">
          <div className="border-b-2 border-ink bg-merino-dark px-3 py-1 font-mono text-[11px] font-semibold tracking-tight uppercase">
            Passage
          </div>
          {/* Long-form: serif, not mono. */}
          <p className="prose-reading px-3 py-3 whitespace-pre-wrap">
            {question.underlines?.length ? (
              renderHighlighted(question.passage, [], question.underlines)
            ) : (
              <MathText text={question.passage} />
            )}
          </p>
        </div>
      )}

      {question.images && question.images.length > 0 && (
        <div className="mb-4 flex flex-col gap-3">
          {question.images.map((img, i) => (
            /* Rendered figures are white PNGs — frame them so they don't float on the paper. */
            <div key={i} className="border-2 border-ink bg-white p-2">
              <img src={img.src} alt={img.alt ?? ''} className="mx-auto block max-w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Skip a prompt that lost graphic-only content — the image carries the real question. */}
      {!(question.promptIsPartial && question.images?.length) && (
        <p className="prose-reading mb-4 whitespace-pre-wrap">
          <MathText text={question.prompt} />
        </p>
      )}

      {answerSummary && <div className="mb-4">{answerSummary}</div>}

      <div>
        <Toggle
          active={showExplanation}
          onToggle={() => setShowExplanation((v) => !v)}
          label={showExplanation ? 'Hide explanation' : 'Show explanation'}
        />
        {showExplanation && (
          <div className="mt-3 border-2 border-ink bg-merino">
            <div className="border-b-2 border-ink bg-venice-blue px-3 py-1 font-mono text-[11px] font-semibold tracking-tight text-merino uppercase">
              Explanation
            </div>
            <p className="prose-reading px-3 py-3 whitespace-pre-wrap">
              <MathText text={question.explanation} />
            </p>
          </div>
        )}
      </div>

      {/* Expanded content gets its own full-bleed drawer at the foot of the card. */}
      {children && (
        <div className="-mx-4 -mb-4 mt-4 border-t-2 border-ink bg-merino px-4 py-4">{children}</div>
      )}
    </Card>
  );
}
