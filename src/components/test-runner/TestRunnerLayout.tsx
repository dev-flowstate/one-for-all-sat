import type { ReactNode } from 'react';

interface TestRunnerLayoutProps {
  hasPassage: boolean;
  passage?: ReactNode;
  question: ReactNode;
}

/**
 * Two-pane (passage | question) on lg+ when there's a passage, stacked below lg.
 * Single centered column, regardless of width, when there's no passage.
 */
export function TestRunnerLayout({ hasPassage, passage, question }: TestRunnerLayoutProps) {
  if (!hasPassage) {
    return <div className="mx-auto max-w-2xl px-4 py-6">{question}</div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6 lg:divide-x lg:divide-rock-blue/40">
        <div className="lg:pr-6">{passage}</div>
        <div className="lg:pl-6">{question}</div>
      </div>
    </div>
  );
}
