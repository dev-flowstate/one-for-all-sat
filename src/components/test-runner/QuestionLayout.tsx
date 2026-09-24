import type { ReactNode } from 'react';
import type { Question } from '../../types/question';
import { HighlightableText } from './HighlightableText';
import { splitPrompt } from '../../lib/promptParts';

interface QuestionLayoutProps {
  question: Question;
  /** Choices or the answer box, and whatever goes under them. */
  children: ReactNode;
}

/**
 * One question, split the way the real test splits it: everything you *read* (passage,
 * stem, figures) on the left, everything you *click* (choices, feedback, Next) on the
 * right. Stacks into one column below `lg`, where side-by-side would leave both halves
 * too narrow to use.
 */
export function QuestionLayout({ question, children }: QuestionLayoutProps) {
  // When the prompt lost graphic-only content, the image below is the real question —
  // showing the broken text above it would just read as gibberish.
  const showPrompt = !(question.promptIsPartial && question.images?.length);

  // Imported banks keep the stimulus and the question in one `prompt` field, so fall back to
  // splitting it here when there's no separate passage.
  const parts = splitPrompt(question.prompt);
  const stimulus = question.passage ?? parts.stimulus;
  const stem = question.passage ? question.prompt : parts.stem;

  // The stem belongs at the top of the answer column, next to the choices it asks about —
  // the way the real test does it. With nothing to read on the left, though, it stays there,
  // because moving it would leave that pane empty.
  const stemGoesRight = !!stimulus;

  // Reading and Writing puts a graph above the text that discusses it, as the test does; in
  // Math the figure follows the words that introduce it.
  const figuresFirst = question.subject === 'reading-writing';
  const figures = question.images && question.images.length > 0 && (
    <div className={`flex flex-col gap-3 ${figuresFirst ? 'mb-4' : 'mt-4'}`}>
      {/* White-background PNGs, so they need a border to sit on the cream paper
          rather than float in it. */}
      {question.images.map((img, i) => (
        <img key={i} src={img.src} alt={img.alt ?? ''} className="max-w-full self-start border-2 border-ink bg-white" />
      ))}
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x-2 lg:divide-ink">
      <div className="min-w-0 lg:pr-6">
        {figuresFirst && figures}
        {stimulus && (
          <HighlightableText
            text={stimulus}
            rangeKey={`${question.id}:stimulus`}
            underlines={question.underlines}
            className="prose-reading"
          />
        )}

        {/* Nothing to read on the left, so the question itself lives here instead. */}
        {!stemGoesRight && showPrompt && (
          <HighlightableText text={stem} rangeKey={`${question.id}:prompt`} className="prose-reading" />
        )}

        {!figuresFirst && figures}
      </div>

      {/* Below lg the columns stack, so the rule has to move to the top edge. */}
      <div className="mt-5 min-w-0 border-t-2 border-ink pt-5 lg:mt-0 lg:border-t-0 lg:pt-0 lg:pl-6">
        {stemGoesRight && showPrompt && (
          <HighlightableText
            text={stem}
            rangeKey={`${question.id}:prompt`}
            className="prose-reading mb-4 font-semibold"
          />
        )}

        {children}
      </div>
    </div>
  );
}
