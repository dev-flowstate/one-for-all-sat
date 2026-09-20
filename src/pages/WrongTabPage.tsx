import { Card } from '../components/ui/Card';

/**
 * OWNER: Phase 1 Track C4.
 * Derived view via src/lib/pools.ts#getWrongPool(questions, progress) from
 * useProgressStore. Each entry: "Show explanation" + "Retry" (retrying correctly
 * should move it to Right — call applySessionResult with a single-answer result,
 * or a dedicated retry action if that reads more clearly). Include a "Reset
 * progress" control using useProgressStore.resetProgress().
 */
export function WrongTabPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Card>
        <p className="text-sm text-venice-blue-dark/70">Wrong questions — coming soon.</p>
      </Card>
    </div>
  );
}
