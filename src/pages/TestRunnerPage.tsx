import { Card } from '../components/ui/Card';

/**
 * OWNER: Phase 1 Track C2 (largest track — may be split into sub-components):
 * crosser (useSessionStore crossedChoices/crosserToolActive), highlighter
 * (src/lib/highlighter/*), SPR input (src/lib/scoring/answerChecking.ts),
 * timer/stopwatch, Desmos toggle (src/lib/desmos/loadDesmos.ts).
 * Reads the active session from useSessionStore (not URL params); redirect to
 * /setup if there's no active queue. On completion, call finishSession() +
 * useProgressStore.applySessionResult(result), then navigate to /results.
 */
export function TestRunnerPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Card>
        <p className="text-sm text-venice-blue-dark/70">Test runner — coming soon.</p>
      </Card>
    </div>
  );
}
