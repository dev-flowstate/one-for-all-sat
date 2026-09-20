import { Card } from '../components/ui/Card';

/**
 * OWNER: Phase 1 Track C3.
 * Reads the last SessionResult (surface it from useSessionStore before clearSession()
 * is called, e.g. stash it in a `lastResult` field, or pass via navigate state).
 * Shows score/points earned and every wrong question from the session with a
 * "Show explanation" toggle (question.explanation). Redirect to / if there's no result.
 */
export function ResultsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Card>
        <p className="text-sm text-venice-blue-dark/70">Results — coming soon.</p>
      </Card>
    </div>
  );
}
