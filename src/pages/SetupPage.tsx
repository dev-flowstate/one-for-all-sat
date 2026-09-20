import { Card } from '../components/ui/Card';

/**
 * OWNER: Phase 1 Track C1.
 * Subject -> domain (+ optional skill) checkboxes, difficulty checkboxes, question-count
 * input (capped to the filtered main pool size), reveal mode, timer mode -> navigate to /run
 * via useSessionStore.startSession(config, queue, initialStreak).
 * Use src/data/taxonomy.ts for filter options and src/lib/pools.ts#getMainPool for the pool.
 */
export function SetupPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-bold text-venice-blue-dark">Set up a practice session</h1>
      <Card>
        <p className="text-sm text-venice-blue-dark/70">Setup screen — coming soon.</p>
      </Card>
    </div>
  );
}
