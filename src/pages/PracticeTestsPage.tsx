import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePracticeTestStore } from '../store/usePracticeTestStore';
import { useProgressStore } from '../store/useProgressStore';
import { BREAK_MINUTES, SECTIONS, buildTest, sectionSize } from '../lib/practiceTest/buildTest';
import { formatClock, moduleTitle } from '../lib/practiceTest/format';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

type Prompt = { kind: 'use-old'; shortBy: number } | { kind: 'too-few'; shortBy: number } | { kind: 'discard' };

/** Starting, resuming and looking back over full-length practice tests. */
export function PracticeTestsPage() {
  const navigate = useNavigate();
  const active = usePracticeTestStore((s) => s.active);
  const history = usePracticeTestStore((s) => s.history);
  const { begin, discard } = usePracticeTestStore.getState();
  const questions = useProgressStore((s) => s.questions);
  const progress = useProgressStore((s) => s.progress);
  const isLoaded = useProgressStore((s) => s.isLoaded);
  const [prompt, setPrompt] = useState<Prompt | null>(null);

  const nextNumber = history.length + 1;

  function start(allowOld: boolean) {
    const built = buildTest(questions, progress, allowOld);
    if (built.shortBy === 0) {
      begin(built.modules);
      navigate('/test');
      return;
    }
    // Only ask about old questions when they'd actually close the gap.
    const withOld = allowOld ? built : buildTest(questions, progress, true);
    setPrompt(
      withOld.shortBy === 0 ? { kind: 'use-old', shortBy: built.shortBy } : { kind: 'too-few', shortBy: withOld.shortBy },
    );
  }

  // Testing time only, the way College Board quotes it (2 h 14 min): the break isn't counted.
  const totalMinutes = SECTIONS.reduce((sum, s) => sum + s.minutes * s.modules.length, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <Link to="/" className="font-mono text-xs font-semibold tracking-tight text-venice-blue uppercase underline-offset-2 hover:underline">
        ← Home
      </Link>
      <h1 className="mt-3 mb-5 text-2xl leading-none font-bold tracking-tight uppercase sm:text-3xl">Practice tests</h1>

      {active ? (
        <Card title={`Practice Test ${active.number} · In progress`}>
          <p className="text-sm">
            {active.stage.kind === 'break'
              ? 'You are on the break between Reading and Writing and Math.'
              : `${moduleTitle(active.modules[active.stage.module])}, with ${formatClock(active.secondsLeft)} left.`}{' '}
            Everything is saved. The clock only runs while the test is open.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button className="w-full" onClick={() => navigate('/test')}>
              Resume test
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setPrompt({ kind: 'discard' })}>
              Discard test
            </Button>
          </div>
        </Card>
      ) : (
        <Card title="Full-length test">
          <table className="w-full border-2 border-ink text-left text-sm">
            <thead className="bg-merino-dark font-mono text-[11px] tracking-tight uppercase">
              <tr>
                <th className="px-3 py-2 font-semibold">Part</th>
                <th className="px-3 py-2 font-semibold">Time</th>
                <th className="px-3 py-2 text-right font-semibold">Questions</th>
              </tr>
            </thead>
            <tbody className="tabular-nums [&_tr]:border-t-2 [&_tr]:border-ink">
              <tr>
                <th className="px-3 py-2">{SECTIONS[0].title}</th>
                <td className="px-3 py-2">2 × {SECTIONS[0].minutes} min</td>
                <td className="px-3 py-2 text-right">{sectionSize(SECTIONS[0])}</td>
              </tr>
              <tr className="text-ink-soft">
                <th className="px-3 py-2 font-normal">Break (you can skip it)</th>
                <td className="px-3 py-2">{BREAK_MINUTES} min</td>
                <td />
              </tr>
              <tr>
                <th className="px-3 py-2">{SECTIONS[1].title}</th>
                <td className="px-3 py-2">2 × {SECTIONS[1].minutes} min</td>
                <td className="px-3 py-2 text-right">{sectionSize(SECTIONS[1])}</td>
              </tr>
              <tr className="bg-merino font-bold">
                <th className="px-3 py-2">Total</th>
                <td className="px-3 py-2">
                  {Math.floor(totalMinutes / 60)} h {totalMinutes % 60} min
                </td>
                <td className="px-3 py-2 text-right">{SECTIONS.reduce((sum, s) => sum + sectionSize(s), 0)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-4 text-sm text-ink-soft">
            The first module of each section mixes easy and medium questions; the second is medium and hard. Questions
            come from the ones you haven&apos;t attempted yet. Each section is scored from 200 to 800, and harder
            questions count for more.
          </p>
          <Button className="mt-5 w-full py-4 text-base" disabled={!isLoaded} onClick={() => start(false)}>
            Make Practice Test {nextNumber}
          </Button>
        </Card>
      )}

      <section className="mt-8">
        <h2 className="mb-3 border-2 border-ink bg-ink px-3 py-1.5 text-xs font-semibold tracking-tight text-merino uppercase">
          Past tests
        </h2>
        {history.length === 0 ? (
          <p className="panel px-4 py-6 text-center text-sm text-ink-soft">Finished tests and their scores show up here.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {[...history].reverse().map((result) => (
              <li key={result.number}>
                <Link
                  to={`/tests/${result.number}`}
                  className="panel press flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-merino-dark"
                >
                  <span className="flex-1 font-bold">Practice Test {result.number}</span>
                  <span className="font-mono text-xs text-ink-soft">
                    {new Date(result.completedAt).toLocaleDateString()}
                  </span>
                  <span className="font-mono text-xs text-ink-soft tabular-nums">
                    R&amp;W {result.readingWriting} · Math {result.math}
                  </span>
                  <span className="text-2xl font-bold tabular-nums">{result.total}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={prompt?.kind === 'use-old'}
        title="Use old questions?"
        confirmLabel="Use old questions"
        onConfirm={() => {
          setPrompt(null);
          start(true);
        }}
        onCancel={() => setPrompt(null)}
      >
        <p>
          There aren&apos;t enough new questions left for a full test. It&apos;s{' '}
          <strong className="tabular-nums">{prompt?.kind === 'use-old' ? prompt.shortBy : 0}</strong> short.
        </p>
        <p>Fill the gap with questions you&apos;ve already answered?</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={prompt?.kind === 'too-few'}
        title="Not enough questions"
        confirmLabel="OK"
        onConfirm={() => setPrompt(null)}
      >
        <p>
          Your question bank is{' '}
          <strong className="tabular-nums">{prompt?.kind === 'too-few' ? prompt.shortBy : 0}</strong> questions short
          of a full test, even counting ones you&apos;ve already answered.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={prompt?.kind === 'discard'}
        title={`Discard Practice Test ${active?.number ?? ''}?`}
        confirmLabel="Discard"
        cancelLabel="Keep it"
        onConfirm={() => {
          setPrompt(null);
          discard();
        }}
        onCancel={() => setPrompt(null)}
      >
        <p>Your answers in this test are deleted, and none of its questions count toward your progress.</p>
      </ConfirmDialog>
    </div>
  );
}
