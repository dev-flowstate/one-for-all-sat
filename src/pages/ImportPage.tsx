import { useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ImportSummary } from '../components/import/ImportSummary';
import { questionBankFileSchema } from '../lib/schema';
import type { Question } from '../types/question';
import { useProgressStore } from '../store/useProgressStore';

type ImportState =
  | { status: 'idle' }
  | { status: 'error'; messages: string[] }
  | { status: 'ready'; questions: Question[]; importing: boolean }
  | { status: 'done'; count: number };

export function ImportPage() {
  const [state, setState] = useState<ImportState>({ status: 'idle' });
  const isBusy = state.status === 'ready' && state.importing;

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setState({ status: 'error', messages: ["That file isn't valid JSON."] });
      return;
    }

    // The file may be `{ questions: [...] }` or a bare `[...]` array — adapt to whichever it is.
    const parsedObj = parsed && typeof parsed === 'object' ? (parsed as { questions?: unknown }) : undefined;
    const result = questionBankFileSchema.safeParse({ questions: parsedObj?.questions ?? parsed });

    if (!result.success) {
      setState({
        status: 'error',
        messages: result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
      });
      return;
    }

    setState({ status: 'ready', questions: result.data.questions, importing: false });
  }

  async function handleConfirm() {
    if (state.status !== 'ready' || state.importing) return;
    const mapped: Question[] = state.questions.map((q) => ({ ...q, source: 'imported' as const }));
    setState({ status: 'ready', questions: state.questions, importing: true });
    await useProgressStore.getState().importQuestions(mapped);
    setState({ status: 'done', count: mapped.length });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link to="/" className="mb-4 inline-block text-sm text-venice-blue hover:underline">
        ← Home
      </Link>
      <h1 className="mb-2 text-2xl font-bold text-venice-blue-dark">Import your question bank</h1>
      <p className="mb-6 text-sm text-venice-blue-dark/70">
        Select a question bank JSON file to load your own questions into this browser. The file stays on this
        device — nothing is uploaded anywhere. Importing replaces any previously imported question bank; the
        built-in demo questions are unaffected.
      </p>

      <Card className="mb-6">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-venice-blue-dark">Question bank file (.json)</span>
          <input
            type="file"
            accept="application/json"
            onChange={handleFileChange}
            disabled={isBusy}
            className="w-full cursor-pointer rounded-lg border border-dashed border-rock-blue-dark/50 bg-merino/40 p-4 text-sm text-venice-blue-dark file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-venice-blue file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-merino hover:file:bg-venice-blue-dark disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>
      </Card>

      {state.status === 'error' && (
        <Card className="mb-6 border-danger/40 bg-danger-bg/40">
          <p className="mb-2 text-sm font-semibold text-danger">That file couldn&apos;t be imported:</p>
          <ul className="list-inside list-disc space-y-1 text-sm text-danger">
            {state.messages.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </Card>
      )}

      {state.status === 'ready' && (
        <Card className="mb-6">
          <ImportSummary questions={state.questions} />
          <Button className="mt-4 w-full" onClick={handleConfirm} disabled={state.importing}>
            {state.importing ? 'Importing…' : 'Confirm Import'}
          </Button>
        </Card>
      )}

      {state.status === 'done' && (
        <Card className="border-success/40 bg-success-bg/40">
          <p className="mb-3 text-sm font-semibold text-success">
            Imported {state.count} question{state.count === 1 ? '' : 's'}.
          </p>
          <Link to="/">
            <Button variant="secondary">Back to home</Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
