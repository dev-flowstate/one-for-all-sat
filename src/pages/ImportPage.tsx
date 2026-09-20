import { Card } from '../components/ui/Card';

/**
 * OWNER: Phase 1 Track C6.
 * File picker (.json) -> JSON.parse -> validate with src/lib/schema.ts#questionBankFileSchema
 * -> show a summary (counts by subject/domain/difficulty) before an explicit "Confirm
 * Import" -> useProgressStore.importQuestions(questions). This is a generic importer
 * for the shared Question JSON schema; the real data file is produced locally by
 * tools/pdf-import/ (never part of this repo) and never leaves the browser once loaded.
 */
export function ImportPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Card>
        <p className="text-sm text-venice-blue-dark/70">Import your question bank — coming soon.</p>
      </Card>
    </div>
  );
}
