import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePracticeTestStore } from '../store/usePracticeTestStore';
import { useProgressStore } from '../store/useProgressStore';
import { BREAK_MINUTES, SECTIONS, buildTest, sectionSize } from '../lib/practiceTest/buildTest';
import { formatClock, moduleTitle, testName } from '../lib/practiceTest/format';
import { PAPER_TESTS, PRESET_TESTS, paperModules, type PaperTest, type PresetTest } from '../data/presetTests';
import type { ActiveTest, PaperPath } from '../types/practiceTest';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

type Prompt =
  | { kind: 'use-old'; shortBy: number }
  | { kind: 'too-few'; shortBy: number }
  | { kind: 'discard'; test: ActiveTest }
  | { kind: 'paper'; paper: PaperTest };

const LEVEL_LABEL: Record<PaperPath['level'], string> = { medium: 'Medium', hard: 'Hard' };

/** "Baseline + Hard", or "Hard module" for second modules taken alone. */
function pathLabel(path: PaperPath): string {
  return path.module2Only ? `${LEVEL_LABEL[path.level]} module` : `Baseline + ${LEVEL_LABEL[path.level]}`;
}

/** Starting, resuming and looking back over full-length practice tests. */
export function PracticeTestsPage() {
  const navigate = useNavigate();
  const active = usePracticeTestStore((s) => s.active);
  const paused = usePracticeTestStore((s) => s.paused);
  const history = usePracticeTestStore((s) => s.history);
  const { begin, discard, resume } = usePracticeTestStore.getState();
  // The one last open first, then the rest, newest first.
  const inProgress = active ? [active, ...paused] : paused;
  const questions = useProgressStore((s) => s.questions);
  const progress = useProgressStore((s) => s.progress);
  const isLoaded = useProgressStore((s) => s.isLoaded);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [timed, setTimed] = useState(true);
  const [level, setLevel] = useState<PaperPath['level']>('hard');

  // Named tests don't take a place in the "Practice Test N" sequence; ones still in progress do.
  const nextNumber = [...history, ...inProgress].filter((t) => !t.presetId).length + 1;
  const storedIds = new Set(questions.map((q) => q.id));
  const presetReady = (preset: PresetTest) =>
    isLoaded &&
    [...preset.modules.flatMap((m) => m.questionIds), ...(preset.routing ?? []).flatMap((r) => r.easierIds)].every(
      (id) => storedIds.has(id),
    );
  const paperReady = (paper: PaperTest) =>
    isLoaded &&
    paper.sections.every((s) => [s.baseline, s.medium, s.hard].every((m) => m.questionIds.every((id) => storedIds.has(id))));
  const readyKey = [...PRESET_TESTS.map(presetReady), ...PAPER_TESTS.map(paperReady)].join();
  /** The finished attempts at a paper that included the baseline modules, oldest first. */
  const fullAttempts = (paper: PaperTest) =>
    history.filter((t) => t.presetId === paper.id && t.paperPath && !t.paperPath.module2Only);

  // A named test's questions live in a file of their own. Fetched on each visit, which picks up
  // a corrected file, and again if they go missing, which they can if the shipped bank's first
  // load finishes after them and replaces the question list with what it read before they were
  // stored.
  useEffect(() => {
    if (!isLoaded) return;
    for (const test of [...PRESET_TESTS, ...PAPER_TESTS]) void useProgressStore.getState().loadTestQuestions(test.file);
  }, [isLoaded, readyKey]);

  function startPreset(preset: PresetTest) {
    begin(preset.modules, timed, { id: preset.id, name: preset.name, routing: preset.routing });
    navigate('/test');
  }

  function startPaper(paper: PaperTest, path: PaperPath) {
    begin(paperModules(paper, path.level, path.module2Only), timed, {
      id: paper.id,
      name: `${paper.name} · ${pathLabel(path)}`,
      paperPath: path,
    });
    navigate('/test');
  }

  function start(allowOld: boolean) {
    const built = buildTest(questions, progress, allowOld);
    if (built.shortBy === 0) {
      begin(built.modules, timed);
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

      {inProgress.length > 0 && (
        <Card className="mb-4" title={inProgress.length === 1 ? 'Saved test' : `Saved tests (${inProgress.length})`}>
          <ul className="flex flex-col gap-4">
            {inProgress.map((test) => (
              <li key={test.createdAt} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{testName(test)}</p>
                  <p className="mt-1 text-sm text-ink-soft">
                    {test.stage.kind === 'break'
                      ? 'On the break between Reading and Writing and Math.'
                      : `${moduleTitle(test.modules[test.stage.module])}${
                          test.timed ? `, with ${formatClock(test.secondsLeft)} left` : ''
                        }.`}{' '}
                    Started {new Date(test.createdAt).toLocaleDateString()}.
                  </p>
                </div>
                <div className="flex flex-none gap-2">
                  <Button
                    onClick={() => {
                      resume(test.createdAt);
                      navigate('/test');
                    }}
                  >
                    Resume
                  </Button>
                  <Button variant="ghost" onClick={() => setPrompt({ kind: 'discard', test })}>
                    Discard
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-ink-soft">
            Everything is saved. A timed test&apos;s clock only runs while it&apos;s open.
          </p>
        </Card>
      )}

        <>
          <section aria-label="Timing" className="mb-4">
          <div className="flex border-2 border-ink bg-paper" role="group" aria-label="Timing">
            {[
              { value: true, label: 'Timed' },
              { value: false, label: 'Untimed' },
            ].map((opt, index) => (
              <button
                key={opt.label}
                type="button"
                aria-pressed={timed === opt.value}
                onClick={() => setTimed(opt.value)}
                className={`min-h-11 flex-1 px-3 py-2.5 text-xs font-semibold tracking-tight uppercase sm:text-sm ${
                  index > 0 ? 'border-l-2 border-ink' : ''
                } ${timed === opt.value ? 'bg-venice-blue text-merino' : 'text-ink hover:bg-merino-dark'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            {timed
              ? 'Each module has its own clock and is submitted when time runs out, as on test day.'
              : 'No clocks: take as long as you need on each module, and submit it when you are done.'}
          </p>
          </section>

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

          {PRESET_TESTS.length > 0 && (
            <Card className="mt-4" title="Named tests">
              <ul className="flex flex-col gap-4">
                {PRESET_TESTS.map((preset) => {
                  const count = preset.modules.reduce((sum, m) => sum + m.questionIds.length, 0);
                  const minutes = preset.modules.reduce((sum, m) => sum + m.minutes, 0);
                  const ready = presetReady(preset);
                  const taken = history.filter((t) => t.presetId === preset.id).length;
                  return (
                    <li key={preset.id} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">{preset.name}</p>
                        <p className="mt-1 text-sm text-ink-soft">
                          {preset.description} {count} questions, {minutes} minutes.
                          {taken > 0 && ` Taken ${taken === 1 ? 'once' : `${taken} times`}.`}
                        </p>
                      </div>
                      <Button className="flex-none" disabled={!ready} onClick={() => startPreset(preset)}>
                        {ready ? 'Start' : 'Loading…'}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {PAPER_TESTS.length > 0 && (
            <Card className="mt-4" title="Papers">
              <ul className="flex flex-col gap-4">
                {PAPER_TESTS.map((paper) => {
                  const ready = paperReady(paper);
                  const taken = history.filter((t) => t.presetId === paper.id);
                  const done = fullAttempts(paper).length > 0;
                  return (
                    <li key={paper.id} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">{paper.name}</p>
                        <p className="mt-1 text-sm text-ink-soft">
                          {done
                            ? 'You’ve done the baseline modules. Next time, take a second module on its own, medium or hard, scored out of 400 per section.'
                            : `${paper.description} Each section is scored out of 800.`}
                          {taken.length > 0 &&
                            ` Taken: ${taken.map((t) => pathLabel(t.paperPath ?? { level: 'hard', module2Only: false })).join(', ')}.`}
                        </p>
                      </div>
                      <Button
                        className="flex-none"
                        disabled={!ready}
                        onClick={() => {
                          const last = fullAttempts(paper).at(-1)?.paperPath;
                          // Second modules alone: suggest the one not done yet.
                          setLevel(last ? (last.level === 'hard' ? 'medium' : 'hard') : 'hard');
                          setPrompt({ kind: 'paper', paper });
                        }}
                      >
                        {ready ? 'Start' : 'Loading…'}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </>

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
                  <span className="flex-1 font-bold">
                    {testName(result)}
                    {!result.timed && <span className="ml-2 font-mono text-xs font-normal text-ink-soft">Untimed</span>}
                  </span>
                  <span className="font-mono text-xs text-ink-soft">
                    {new Date(result.completedAt).toLocaleDateString()}
                  </span>
                  {result.total !== null ? (
                    <>
                      <span className="font-mono text-xs text-ink-soft tabular-nums">
                        R&amp;W {result.readingWriting} · Math {result.math}
                      </span>
                      <span className="text-2xl font-bold tabular-nums">{result.total}</span>
                    </>
                  ) : (
                    <span className="flex items-baseline gap-1.5">
                      <span className="font-mono text-xs text-ink-soft">{result.math === null ? 'R&W' : 'Math'}</span>
                      <span className="text-2xl font-bold tabular-nums">{result.readingWriting ?? result.math}</span>
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(() => {
        const paper = prompt?.kind === 'paper' ? prompt.paper : null;
        const last = paper ? fullAttempts(paper).at(-1) : undefined;
        const module2Only = last !== undefined;
        const doneLevels = paper
          ? history.filter((t) => t.presetId === paper.id && t.paperPath).map((t) => t.paperPath!.level)
          : [];
        return (
          <ConfirmDialog
            open={paper !== null}
            title={module2Only ? 'You already did the baseline' : paper?.name ?? ''}
            confirmLabel="Start"
            onConfirm={() => {
              setPrompt(null);
              if (paper) startPaper(paper, { level, module2Only });
            }}
            onCancel={() => setPrompt(null)}
          >
            {module2Only && last ? (
              <p>
                You took {paper?.name} as <strong>{pathLabel(last.paperPath!)}</strong> on{' '}
                {new Date(last.completedAt).toLocaleDateString()}. This time it&apos;s a second module on its own:
                Reading and Writing, then Math, each scored out of <strong>400</strong>.
              </p>
            ) : (
              <p>
                Each section starts with its baseline module, then the second module you choose. Each section is scored
                out of <strong>800</strong>; the medium path tops out at 650, as the easier route does on the real test.
              </p>
            )}
            <div className="flex border-2 border-ink bg-paper" role="group" aria-label="Second module">
              {(['medium', 'hard'] as const).map((value, index) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={level === value}
                  onClick={() => setLevel(value)}
                  className={`min-h-11 flex-1 px-3 py-2.5 text-xs font-semibold tracking-tight uppercase sm:text-sm ${
                    index > 0 ? 'border-l-2 border-ink' : ''
                  } ${level === value ? 'bg-venice-blue text-merino' : 'text-ink hover:bg-merino-dark'}`}
                >
                  {pathLabel({ level: value, module2Only })}
                  {module2Only && doneLevels.includes(value) && <span className="block text-[10px] normal-case">done before</span>}
                </button>
              ))}
            </div>
          </ConfirmDialog>
        );
      })()}

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
        title={`Discard ${prompt?.kind === 'discard' ? testName(prompt.test) : 'this test'}?`}
        confirmLabel="Discard"
        cancelLabel="Keep it"
        onConfirm={() => {
          if (prompt?.kind === 'discard') discard(prompt.test.createdAt);
          setPrompt(null);
        }}
        onCancel={() => setPrompt(null)}
      >
        <p>Your answers in this test are deleted, and none of its questions count toward your progress.</p>
      </ConfirmDialog>
    </div>
  );
}
