import { useState } from 'react';
import type { Question, ChoiceId } from '../../types/question';
import type { RevealMode } from '../../types/settings';
import type { AttemptOutcome } from '../../types/progress';
import { useSessionStore } from '../../store/useSessionStore';
import { checkMcqAnswer, checkSprAnswer } from '../../lib/scoring/answerChecking';
import { HighlightableText } from './HighlightableText';
import { McqChoices } from './McqChoices';
import { SprInput } from './SprInput';
import { AnswerFeedback } from './AnswerFeedback';
import { Button } from '../ui/Button';

interface QuestionPanelProps {
  question: Question;
  revealMode: RevealMode;
  isLast: boolean;
  onNext: () => void;
}

// Stable reference so the Zustand selector below doesn't return a fresh `[]` on every
// render when nothing's crossed out yet — a new array each time makes useSyncExternalStore
// think the snapshot always changed, causing an infinite render loop.
const EMPTY_CHOICE_IDS: ChoiceId[] = [];

/**
 * One question, split the way the real test splits it: everything you *read* (passage,
 * stem, figures) on the left, everything you *click* (choices, feedback, Next) on the
 * right. Stacks into one column below `lg`, where side-by-side would leave both halves
 * too narrow to use.
 *
 * Mount this keyed by question.id so all local per-question UI state resets on navigation.
 */
export function QuestionPanel({ question, revealMode, isLast, onNext }: QuestionPanelProps) {
  const [sprValue, setSprValue] = useState('');
  const crosserActive = useSessionStore((s) => s.crosserActive);
  const crossedIds = useSessionStore((s) => s.crossedChoices[question.id] ?? EMPTY_CHOICE_IDS);
  const answered = useSessionStore((s) => s.answers[question.id]);
  const answerCurrent = useSessionStore((s) => s.answerCurrent);
  const toggleCrossedChoice = useSessionStore((s) => s.toggleCrossedChoice);
  const submitted = !!answered;

  function handleChoiceClick(choiceId: ChoiceId) {
    const crossed = crossedIds.includes(choiceId);
    if (crossed) {
      // Always allowed, even after the question is answered — never locked out.
      toggleCrossedChoice(question.id, choiceId);
      return;
    }
    if (submitted) return;
    if (crosserActive) {
      toggleCrossedChoice(question.id, choiceId);
      return;
    }
    const outcome: AttemptOutcome = checkMcqAnswer(choiceId, question.correctChoice) ? 'correct' : 'incorrect';
    answerCurrent(outcome, choiceId);
  }

  function handleSprSubmit() {
    if (submitted || !sprValue.trim()) return;
    const outcome: AttemptOutcome = checkSprAnswer(sprValue, question.acceptableAnswers ?? []) ? 'correct' : 'incorrect';
    answerCurrent(outcome, undefined, sprValue);
  }

  // When the prompt lost graphic-only content, the image below is the real question —
  // showing the broken text above it would just read as gibberish.
  const showPrompt = !(question.promptIsPartial && question.images?.length);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x-2 lg:divide-ink">
      <div className="min-w-0 lg:pr-6">
        {question.passage && (
          <div className="mb-4 border-2 border-ink bg-merino">
            <div className="border-b-2 border-ink bg-merino-dark px-3 py-1 font-mono text-[11px] font-semibold tracking-tight uppercase">
              Passage
            </div>
            <HighlightableText
              text={question.passage}
              rangeKey={`${question.id}:passage`}
              className="prose-reading px-3 py-3"
            />
          </div>
        )}

        {showPrompt && (
          <HighlightableText
            text={question.prompt}
            rangeKey={`${question.id}:prompt`}
            className="prose-reading"
          />
        )}

        {question.images && question.images.length > 0 && (
          <div className="mt-4 flex flex-col gap-3">
            {/* White-background PNGs, so they need a border to sit on the cream paper
                rather than float in it. */}
            {question.images.map((img, i) => (
              <img
                key={i}
                src={img.src}
                alt={img.alt ?? ''}
                className="max-w-full self-start border-2 border-ink bg-white"
              />
            ))}
          </div>
        )}
      </div>

      {/* Below lg the columns stack, so the rule has to move to the top edge. */}
      <div className="mt-5 min-w-0 border-t-2 border-ink pt-5 lg:mt-0 lg:border-t-0 lg:pt-0 lg:pl-6">
        {question.type === 'mcq' ? (
          <McqChoices
            choices={question.choices ?? []}
            crossedIds={crossedIds}
            submitted={submitted}
            selectedChoice={answered?.selectedChoice}
            correctChoice={question.correctChoice}
            revealMode={revealMode}
            onChoiceClick={handleChoiceClick}
          />
        ) : (
          <SprInput value={sprValue} onChange={setSprValue} onSubmit={handleSprSubmit} submitted={submitted} />
        )}

        {submitted && answered && (
          <div className="mt-5">
            {revealMode === 'immediate' && (
              <AnswerFeedback outcome={answered.outcome} explanation={question.explanation} />
            )}
            <Button className="mt-4 w-full" onClick={onNext}>
              {isLast ? 'Finish' : 'Next'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
