import { useState } from 'react';
import type { ActiveTest } from '../../types/practiceTest';
import { usePracticeTestStore } from '../../store/usePracticeTestStore';
import { formatClock, moduleTitle } from '../../lib/practiceTest/format';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { QuestionGrid } from './QuestionGrid';

interface ModuleReviewProps {
  test: ActiveTest;
  moduleIndex: number;
}

/**
 * "Check your work": the end-of-module page that shows what's blank and what's marked for
 * review, and where the module is submitted. Submitting always asks first, since there's no
 * coming back to a module once it's done.
 */
export function ModuleReview({ test, moduleIndex }: ModuleReviewProps) {
  const goTo = usePracticeTestStore((s) => s.goTo);
  const submitModule = usePracticeTestStore((s) => s.submitModule);
  const [confirming, setConfirming] = useState(false);

  const module = test.modules[moduleIndex];
  const ids = module.questionIds;
  const unanswered = ids.filter((id) => !test.responses[id]?.choice && !test.responses[id]?.text).length;
  const marked = ids.filter((id) => test.marked.includes(id)).length;
  const isLastModule = moduleIndex === test.modules.length - 1;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Card title="Check your work">
        <p className="font-mono text-xs font-bold tracking-tight text-ink-soft uppercase">{moduleTitle(module)}</p>
        <p className="mt-3 text-sm">
          {unanswered === 0 && marked === 0
            ? 'Every question has an answer. '
            : `${unanswered} unanswered, ${marked} marked for review. `}
          Select a number to go back to that question. You can keep changing answers until you submit.
        </p>

        <div className="mt-5">
          <QuestionGrid questionIds={ids} responses={test.responses} marked={test.marked} onSelect={goTo} />
        </div>

        <Button className="mt-6 w-full py-4 text-base" onClick={() => setConfirming(true)}>
          {isLastModule ? 'Finish test' : 'Submit module'}
        </Button>
      </Card>

      <ConfirmDialog
        open={confirming}
        title="Are you sure?"
        confirmLabel={isLastModule ? 'Yes, finish the test' : 'Yes, submit'}
        cancelLabel="Keep working"
        onConfirm={() => {
          setConfirming(false);
          submitModule();
        }}
        onCancel={() => setConfirming(false)}
      >
        <p>
          {test.timed && (
            <>
              You still have <strong className="tabular-nums">{formatClock(test.secondsLeft)}</strong> left on this
              module.{' '}
            </>
          )}
          Once you submit, you can&apos;t go back to its questions.
        </p>
        {unanswered > 0 && (
          <p className="font-semibold text-danger">
            {unanswered} {unanswered === 1 ? 'question is' : 'questions are'} still unanswered and will count as
            wrong.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
