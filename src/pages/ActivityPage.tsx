import { useMemo, useState } from 'react';
import { useProgressStore } from '../store/useProgressStore';
import { useVocabStore } from '../store/useVocabStore';
import { usePracticeTestStore } from '../store/usePracticeTestStore';
import { dayKey, getActivity, rebuildEarlierDays, type DayActivity } from '../lib/activity';

const STRIP_DAYS = 28;

function dayLabel(key: string): string {
  const today = dayKey();
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (key === today) return 'Today';
  if (key === dayKey(y)) return 'Yesterday';
  const [yr, m, d] = key.split('-').map(Number);
  return new Date(yr, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

/** How much was done in a day, for the strip: questions, plus a little for words, tests and doodles. */
const effort = (d?: DayActivity) => (d ? d.answered + d.words / 3 + d.tests * 20 + d.doodles : 0);

/** What was done each day: questions by topic, flashcards, practice tests and doodles. */
export function ActivityPage() {
  const questions = useProgressStore((s) => s.questions);
  const progress = useProgressStore((s) => s.progress);
  const isLoaded = useProgressStore((s) => s.isLoaded);
  const vocab = useVocabStore((s) => s.progress);
  const history = usePracticeTestStore((s) => s.history);

  // Once the bank's details are in, fill in the days before the log began from the latest
  // attempts, then read the log.
  const [rebuiltFor, setRebuiltFor] = useState(false);
  if (isLoaded && !rebuiltFor) {
    setRebuiltFor(true);
    const skillOf = new Map(questions.map((q) => [q.id, q.skill]));
    rebuildEarlierDays({
      attempts: Object.entries(progress)
        .filter(([, s]) => s.lastAttemptedAt && s.status !== 'unattempted')
        .map(([id, s]) => ({ skill: skillOf.get(id) ?? 'Other', correct: s.status === 'correct', at: s.lastAttemptedAt! })),
      words: Object.values(vocab)
        .filter((v) => v.lastReviewedAt && v.status !== 'unseen')
        .map((v) => ({ right: v.status === 'right', at: v.lastReviewedAt! })),
      tests: history.map((t) => ({ at: t.completedAt })),
    });
  }
  const days = useMemo(() => (rebuiltFor ? getActivity() : {}), [rebuiltFor]);
  const keys = useMemo(() => Object.keys(days).sort().reverse(), [days]);
  const [open, setOpen] = useState<string | null>(null);

  const strip = useMemo(() => {
    const out: { key: string; level: number; d?: DayActivity }[] = [];
    for (let i = STRIP_DAYS - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = dayKey(date);
      const e = effort(days[key]);
      out.push({ key, d: days[key], level: e === 0 ? 0 : e < 10 ? 1 : e < 30 ? 2 : 3 });
    }
    return out;
  }, [days]);

  const week = useMemo(() => {
    const total = { answered: 0, correct: 0, words: 0, tests: 0, activeDays: 0 };
    for (const s of strip.slice(-7)) {
      if (!s.d) continue;
      total.answered += s.d.answered;
      total.correct += s.d.correct;
      total.words += s.d.words;
      total.tests += s.d.tests;
      if (effort(s.d) > 0) total.activeDays += 1;
    }
    return total;
  }, [strip]);

  const LEVELS = ['bg-paper', 'bg-rock-blue', 'bg-venice-blue', 'bg-success'];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <header className="mb-5">
        <h1 className="text-2xl leading-none font-bold tracking-tight uppercase sm:text-3xl">Activity log</h1>
        <p className="mt-2 text-sm text-ink-soft">What you did each day, newest first. Tap a day to see it by topic.</p>
      </header>

      {!isLoaded ? (
        <p className="panel p-4 text-sm text-ink-soft">Loading…</p>
      ) : (
        <>
          <section className="panel mb-5 p-4">
            <p className="mb-2 text-[11px] font-semibold tracking-tight uppercase">Last 4 weeks</p>
            <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1 sm:gap-1.5">
              {strip.map((s) => (
                <span
                  key={s.key}
                  title={`${dayLabel(s.key)}: ${s.d ? `${s.d.answered} questions, ${s.d.words} words` : 'nothing'}`}
                  className={`aspect-square border-2 border-ink ${LEVELS[s.level]} ${s.key === dayKey() ? 'outline-2 outline-offset-1 outline-coral' : ''}`}
                />
              ))}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-[2px] border-2 border-ink bg-ink sm:grid-cols-4">
              {[
                ['Active days, this week', `${week.activeDays}/7`],
                ['Questions, this week', String(week.answered)],
                ['Correct, this week', `${pct(week.correct, week.answered)}%`],
                ['Words, this week', String(week.words)],
              ].map(([label, value]) => (
                <div key={label} className="bg-merino-dark px-3 py-2">
                  <dt className="text-[10px] font-semibold tracking-tight text-ink-soft uppercase">{label}</dt>
                  <dd className="text-lg font-bold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {keys.length === 0 ? (
            <p className="panel p-4 text-sm text-ink-soft">
              Nothing yet. Answer some questions or drill some words and each day will be listed here.
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {keys.map((key) => {
                const d = days[key];
                const isOpen = open === key;
                const topics = Object.entries(d.topics).sort(([, a], [, b]) => b[0] - a[0]);
                return (
                  <li key={key} className="panel">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpen(isOpen ? null : key)}
                      className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-merino"
                    >
                      <span className="min-w-28 font-mono text-sm font-bold uppercase">{dayLabel(key)}</span>
                      <span className="flex flex-1 flex-wrap gap-x-4 gap-y-1 text-sm">
                        {d.answered > 0 && (
                          <span>
                            <b className="tabular-nums">{d.answered}</b> question{d.answered === 1 ? '' : 's'} ·{' '}
                            <b className="tabular-nums">{pct(d.correct, d.answered)}%</b> right
                          </span>
                        )}
                        {d.words > 0 && (
                          <span>
                            <b className="tabular-nums">{d.words}</b> word{d.words === 1 ? '' : 's'}
                          </span>
                        )}
                        {d.tests > 0 && (
                          <span>
                            <b className="tabular-nums">{d.tests}</b> practice test{d.tests === 1 ? '' : 's'}
                          </span>
                        )}
                        {d.doodles > 0 && (
                          <span>
                            <b className="tabular-nums">{d.doodles}</b> doodle{d.doodles === 1 ? '' : 's'} saved
                          </span>
                        )}
                      </span>
                      <span aria-hidden="true" className="font-mono text-xs">
                        {isOpen ? '▲' : '▼'}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="border-t-2 border-ink px-4 py-3">
                        {topics.length === 0 ? (
                          <p className="text-sm text-ink-soft">No questions this day.</p>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-[10px] tracking-tight text-ink-soft uppercase">
                                <th className="pb-1 font-semibold">Topic</th>
                                <th className="pb-1 text-right font-semibold">Answered</th>
                                <th className="pb-1 text-right font-semibold">Right</th>
                              </tr>
                            </thead>
                            <tbody>
                              {topics.map(([skill, [n, right]]) => (
                                <tr key={skill} className="border-t border-ink/20">
                                  <td className="py-1.5 pr-2">{skill}</td>
                                  <td className="py-1.5 text-right tabular-nums">{n}</td>
                                  <td className="py-1.5 text-right tabular-nums">
                                    {right} ({pct(right, n)}%)
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        {d.rebuilt && (
                          <p className="mt-2 text-[11px] text-ink-soft">
                            From before the log began: rebuilt from your latest attempt at each question, so repeats
                            of a question aren&apos;t counted.
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          <p className="mt-4 text-[11px] text-ink-soft">The log is kept in this browser.</p>
        </>
      )}
    </div>
  );
}
