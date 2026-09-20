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

/**
 * The question pane for one question: prompt, images, choices/SPR input, and (once
 * answered) feedback + Next/Finish. Mount this keyed by question.id so all local
 * per-question UI state resets automatically when the parent moves to a new question.
 */
export function QuestionPanel({ question, revealMode, isLast, onNext }: QuestionPanelProps) {
  const [sprValue, setSprValue] = useState('');
  const crosserActive = useSessionStore((s) => s.crosserActive);
  const crossedIds = useSessionStore((s) => s.crossedChoices[question.id] ?? []);
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

  return (
    <div>
      <HighlightableText text={question.prompt} rangeKey={`${question.id}:prompt`} className="text-base leading-relaxed" />

      {question.images && question.images.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {question.images.map((img, i) => (
            <img key={i} src={img.src} alt={img.alt ?? ''} className="max-w-full rounded-lg" />
          ))}
        </div>
      )}

      <div className="mt-5">
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
      </div>

      {submitted && answered && (
        <div className="mt-5">
          {revealMode === 'immediate' && <AnswerFeedback outcome={answered.outcome} explanation={question.explanation} />}
          <Button className="mt-3 w-full sm:w-auto" onClick={onNext}>
            {isLast ? 'Finish' : 'Next'}
          </Button>
        </div>
      )}
    </div>
  );
}
