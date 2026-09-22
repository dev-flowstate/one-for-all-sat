import { useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ProgressBar } from '../components/ui/ProgressBar';
import { ImportSummary } from '../components/import/ImportSummary';
import { questionBankFileSchema } from '../lib/schema';
import type { Question } from '../types/question';
import { useProgressStore } from '../store/useProgressStore';

type ImportState =
  | { status: 'idle' }
  | { status: 'error'; messages: string[] }
  | { status: 'ready'; questions: Question[]; importing: boolean; written: number }
  | { status: 'done'; count: number };

/** Turns a storage failure into something a person can act on. Running out of room is by far
 *  the most common way a big bank fails to import, and phones hit it long before desktops. */
function describeImportFailure(error: unknown): string[] {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'QuotaExceededError') {
    return [
      "This device doesn't have enough free storage for a bank this size.",
      'Free up space, or import a smaller bank (for example English only instead of the combined file).',
    ];
  }
  const detail = error instanceof Error ? error.message : String(error);
  return [`The import failed partway through: ${detail}`, 'Your previous question bank may have been cleared.'];
}

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

    setState({ status: 'ready', questions: result.data.questions, importing: false, written: 0 });
  }

  async function handleConfirm() {
    if (state.status !== 'ready' || state.importing) return;
    const { questions } = state;
    setState({ status: 'ready', questions, importing: true, written: 0 });

    try {
      // The store forces `source: 'imported'` as it writes, so there's no second copy of
      // the whole array here — that copy alone can be tens of MB on a phone.
      await useProgressStore.getState().importQuestions(questions, (written) => {
        setState({ status: 'ready', questions, importing: true, written });
      });
      setState({ status: 'done', count: questions.length });
    } catch (error) {
      // Without this the button sits on "Importing…" forever and the only trace is an
      // unhandled rejection in a console nobody has open — especially on a phone.
      setState({ status: 'error', messages: describeImportFailure(error) });
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <Link
        to="/"
        className="mb-4 inline-block text-xs font-semibold tracking-tight text-venice-blue uppercase hover:underline"
      >
        ← Home
      </Link>
      <h1 className="mb-2 text-2xl leading-none font-bold tracking-tight uppercase sm:text-3xl">
        Import question bank
      </h1>
      <p className="mb-5 text-sm text-ink-soft">
        Select a question bank JSON file to load your own questions into this browser. The file stays on this
        device — nothing is uploaded anywhere. Importing replaces any previously imported question bank; the
        built-in demo questions are unaffected.
      </p>

      <Card className="mb-4" title="Choose a file">
        <label className="flex cursor-pointer flex-col gap-2 border-2 border-dashed border-ink bg-merino-dark p-5">
          <span className="text-xs font-semibold tracking-tight text-ink-soft uppercase">
            Question bank file (.json)
          </span>
          <input
            type="file"
            accept="application/json"
            onChange={handleFileChange}
            disabled={isBusy}
            className="w-full cursor-pointer text-sm file:mr-3 file:min-h-11 file:cursor-pointer file:border-2 file:border-ink file:bg-venice-blue file:px-3 file:py-2 file:font-mono file:text-sm file:font-semibold file:tracking-tight file:text-merino file:uppercase hover:file:bg-venice-blue-dark disabled:cursor-not-allowed disabled:opacity-40"
          />
        </label>
      </Card>

      {state.status === 'error' && (
        <div className="mb-4 border-2 border-danger bg-danger-bg shadow-[4px_4px_0_var(--color-danger)]">
          <div className="border-b-2 border-danger bg-danger px-3 py-1.5 text-xs font-semibold tracking-tight text-paper uppercase">
            Couldn&apos;t import that file
          </div>
          <ul className="list-inside list-disc space-y-1 p-4 text-sm text-danger">
            {state.messages.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {state.status === 'ready' && (
        <Card className="mb-4" title="Ready to import">
          <ImportSummary questions={state.questions} />
          {state.importing && (
            <div className="mt-4">
              <ProgressBar value={(state.written / Math.max(state.questions.length, 1)) * 100} />
              <p className="mt-1.5 text-xs font-semibold tracking-tight text-ink-soft tabular-nums uppercase">
                Saving {state.written} / {state.questions.length}
              </p>
            </div>
          )}
          <Button className="mt-4 w-full" onClick={handleConfirm} disabled={state.importing}>
            {state.importing ? 'Importing…' : 'Confirm import'}
          </Button>
        </Card>
      )}

      {state.status === 'done' && (
        <div className="border-2 border-success bg-success-bg shadow-[4px_4px_0_var(--color-success)]">
          <div className="border-b-2 border-success bg-success px-3 py-1.5 text-xs font-semibold tracking-tight text-paper uppercase">
            Imported
          </div>
          <div className="p-4">
            <p className="mb-3 text-sm font-semibold text-success">
              {state.count} question{state.count === 1 ? '' : 's'} loaded into this browser.
            </p>
            <Link to="/">
              <Button variant="secondary">Back to home</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
