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
      {/* One ink rule between the panes; the padding either side keeps each panel's hard
          shadow clear of it. min-w-0 stops a long word or a wide figure blowing the grid out. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-0 lg:divide-x-2 lg:divide-ink">
        <div className="min-w-0 lg:pr-8">{passage}</div>
        <div className="min-w-0 lg:pl-8">{question}</div>
      </div>
    </div>
  );
}
