import { Card } from '../components/ui/Card';

/**
 * OWNER: Phase 1 Track C4 (paired with WrongTabPage).
 * Derived view via src/lib/pools.ts#getRightPool(questions, progress). Include a
 * "Practice again" action per question (requeue into main pool via resetProgress([id])).
 */
export function RightTabPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Card>
        <p className="text-sm text-venice-blue-dark/70">Right questions — coming soon.</p>
      </Card>
    </div>
  );
}
