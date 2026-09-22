import type { ReactNode } from 'react';

interface TestRunnerLayoutProps {
  children: ReactNode;
}

/**
 * Width container for the running test. The read/answer split lives inside QuestionPanel,
 * since the passage, stem and choices all need to share one grid to line up.
 */
export function TestRunnerLayout({ children }: TestRunnerLayoutProps) {
  return <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>;
}
