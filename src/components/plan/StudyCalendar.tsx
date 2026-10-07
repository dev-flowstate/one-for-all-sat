import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProgressStore } from '../../store/useProgressStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useVocabStore } from '../../store/useVocabStore';
import { MIN_ANSWERED, sameSkill, skillStats, type SkillStat } from '../../lib/topicStats';
import { buildPlan, isOn, localDate, shortSkill, weekday, type PlanDay, type PlanTask } from '../../lib/studyPlan';
import { analyzeMistakes, describeInsight, type Trend } from '../../lib/mistakes';
import { startPractice } from '../../lib/startPractice';
import { BOOKS, getReadingProgress } from '../../lib/reading';
import { VOCAB_CARD_COUNT } from '../../data/vocab/count';
import { satLabel, satStart, upcomingSatDates } from '../../data/satDates';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { TopicPicker } from '../setup/TopicPicker';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** Below this share right, after enough answers, a topic counts as weak for the plan. */
const WEAK_FOR_PLAN = 60;

/** The plan's days grouped by month, each month padded to start on a Monday. */
function months(days: PlanDay[]): { label: string; cells: (PlanDay | null)[] }[] {
  const out: { label: string; cells: (PlanDay | null)[] }[] = [];
  for (const day of days) {
    const [y, m] = day.date.split('-').map(Number);
    const label = new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    let month = out.at(-1);
    if (month?.label !== label) {
      month = { label, cells: Array((weekday(day.date) + 6) % 7).fill(null) };
      out.push(month);
    }
    month.cells.push(day);
  }
  return out;
}

function prettyDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

/** Topics most in need first: lowest accuracy, then those with most left to do. Untried topics
 *  sit in the middle, as if half right. */
function byNeed(skills: string[], stats: SkillStat[]): string[] {
  const statOf = (s: string) => stats.find((t) => sameSkill(t.skill, s));
  const need = (s: string) => {
    const stat = statOf(s);
    return stat && stat.accuracy !== null && stat.answered >= MIN_ANSWERED ? stat.accuracy : 50;
  };
  return [...skills].sort((a, b) => need(a) - need(b) || (statOf(b)?.total ?? 0) - (statOf(a)?.total ?? 0));
}

/** What a square on the calendar says. */
function cellLabel(day: PlanDay): string {
  switch (day.kind) {
    case 'sat':
      return 'SAT';
    case 'test':
      return 'Full test';
    case 'light':
      return 'Light';
    default: {
      const topics = day.tasks.filter((t) => t.kind === 'practice');
      const lead = day.kind === 'quiz' ? 'Quiz' : day.kind === 'review' ? 'Review' : null;
      const first = topics[0]?.kind === 'practice' ? shortSkill(topics[0].skill) : '';
      return [lead, first, topics.length > 1 ? `+${topics.length - 1}` : ''].filter(Boolean).join(' · ');
    }
  }
}

/**
 * The home screen's study plan. The student picks the topics to work on (or all of them), and
 * the plan sets each day's work until the SAT: which topics, at what level and how many
 * questions, short quizzes, full practice tests, words to learn and chapters to read. Every
 * task opens straight onto its questions.
 */
export function StudyCalendar() {
  const navigate = useNavigate();
  const profile = useSettingsStore((s) => s.profile);
  const satDate = profile?.satDate;
  const planStart = profile?.studyPlanStart;
  const planSkills = profile?.studyPlanSkills;
  const { setSatDate, setStudyPlan } = useSettingsStore.getState();
  const questions = useProgressStore((s) => s.questions);
  const progress = useProgressStore((s) => s.progress);
  const isLoaded = useProgressStore((s) => s.isLoaded);
  const vocab = useVocabStore((s) => s.progress);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>(planSkills ?? []);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [shownDay, setShownDay] = useState<string | null>(null);

  const today = localDate(new Date());
  const satAhead = satDate !== undefined && satStart(satDate) > new Date();
  const stats = useMemo(() => skillStats(questions, progress), [questions, progress]);
  const readingChapter = getReadingProgress(BOOKS[0].id)?.chapter ?? 0;

  // What was done today, so today's targets are set from this morning and progress shows.
  const done = useMemo(() => {
    const firstToday = questions.filter((q) => {
      const s = progress[q.id];
      return s && s.attempts === 1 && isOn(s.lastAttemptedAt, today);
    });
    const wordsToday = Object.values(vocab).filter((s) => s.status !== 'unseen' && s.reviews === 1 && isOn(s.lastReviewedAt, today)).length;
    const wordsSeen = Object.values(vocab).filter((s) => s.status !== 'unseen').length;
    return {
      firstToday,
      wordsToday,
      wordsLeft: Math.max(0, VOCAB_CARD_COUNT - wordsSeen) + wordsToday,
    };
  }, [questions, progress, vocab, today]);

  // The plan works from answers as they stood this morning: today's tasks then hold while they're
  // done, and today's mistakes shape tomorrow's plan.
  const morning = useMemo(
    () => Object.fromEntries(Object.entries(progress).filter(([, s]) => !isOn(s.lastAttemptedAt, today))),
    [progress, today],
  );
  const insights = useMemo(() => analyzeMistakes(questions, morning), [questions, morning]);

  const result = useMemo(() => {
    if (!planStart || !satDate || !satAhead || !isLoaded) return null;
    return buildPlan({
      start: planStart,
      today,
      satDate,
      skills: planSkills ?? [],
      progress: morning,
      questions,
      insights,
      wordsLeft: done.wordsLeft,
      readingChapter,
    });
  }, [planStart, satDate, satAhead, isLoaded, today, planSkills, morning, questions, insights, done, readingChapter]);
  const plan = result?.days ?? null;

  async function run(task: PlanTask, key: string) {
    if (task.kind === 'practice' || task.kind === 'quiz' || task.kind === 'redo') {
      setStarting(key);
      const ok = await startPractice(
        task.kind === 'practice'
          ? { skills: [task.skill], difficulty: task.difficulty, count: task.count, revealMode: 'immediate', timerMode: 'none' }
          : task.kind === 'redo'
            ? { skills: [task.skill], onlyWrong: true, count: task.count, revealMode: 'immediate', timerMode: 'none' }
            : { skills: task.skills, count: task.count, revealMode: 'end', timerMode: 'countdown', countdownMinutes: task.minutes },
      );
      setStarting(null);
      if (ok) navigate('/run');
      return;
    }
    const routes: Partial<Record<PlanTask['kind'], string>> = { review: '/wrong', test: '/tests', words: '/vocab', reading: '/read' };
    const route = routes[task.kind];
    if (route) navigate(route);
  }

  /** One task, as a button that starts it. */
  function renderTask(task: PlanTask, k: string, isToday: boolean) {
    let title = '';
    let detail = '';
    let progressDone: number | null = null;
    let progressOf = 0;
    switch (task.kind) {
      case 'practice':
        title = `${task.count} ${task.skill} questions`;
        detail = [task.difficulty, task.subject === 'math' ? 'Math' : 'Reading & Writing', task.note].filter(Boolean).join(' · ');
        progressDone = done.firstToday.filter((q) => sameSkill(q.skill, task.skill)).length;
        progressOf = task.count;
        break;
      case 'redo':
        title = `Redo ${task.count} ${task.skill} ${task.count === 1 ? 'question' : 'questions'} you missed`;
        detail = 'Answers checked as you go, with explanations';
        break;
      case 'quiz':
        title = `Mini test: ${task.count} mixed questions`;
        detail = `${task.minutes} minutes, answers at the end, on what you've practised and what's going wrong`;
        break;
      case 'review':
        title = task.label;
        detail = task.count > 0 ? `${task.count} from your Wrong tab` : 'Nothing wrong to redo yet';
        break;
      case 'test':
        title = 'Full practice test';
        detail = 'Timed, about 2 h 14 min, with the break';
        break;
      case 'words':
        title = `Learn ${task.count} words`;
        detail = 'Vocabulary flashcards';
        progressDone = done.wordsToday;
        progressOf = task.count;
        break;
      case 'reading':
        title = task.from === task.to ? `Read chapter ${task.from}` : `Read chapters ${task.from}–${task.to}`;
        detail = 'Pride and Prejudice';
        break;
      case 'rest':
        title = task.label;
        break;
    }
    const startable = task.kind !== 'rest' && !(task.kind === 'review' && task.count === 0);
    const complete = progressDone !== null && progressDone >= progressOf;
    return (
      <li key={k}>
        <button
          type="button"
          disabled={!startable || starting !== null}
          onClick={() => void run(task, k)}
          className="press flex w-full items-center gap-3 border-2 border-ink bg-paper px-3 py-2.5 text-left hover:bg-merino disabled:cursor-default disabled:hover:bg-paper"
        >
          <span className="min-w-0 flex-1">
            <span className={`block text-sm font-bold ${complete ? 'text-success' : ''}`}>
              {complete && '✓ '}
              {title}
            </span>
            {detail && <span className="block font-mono text-[11px] text-ink-soft">{detail}</span>}
            {isToday && progressDone !== null && (
              <span className="mt-1.5 block h-2 border-2 border-ink bg-merino">
                <span
                  className={`block h-full ${complete ? 'bg-success' : 'bg-venice-blue'}`}
                  style={{ width: `${Math.min(100, (progressDone / Math.max(1, progressOf)) * 100)}%` }}
                />
              </span>
            )}
          </span>
          {startable && (
            <span className="flex-none font-mono text-xs font-bold text-venice-blue uppercase">
              {starting === k ? 'Loading…' : 'Start →'}
            </span>
          )}
        </button>
      </li>
    );
  }

  // Making the plan, or changing its topics.
  if (!plan || editing) {
    const upcoming = upcomingSatDates();
    const weak = byNeed(
      stats.filter((s) => s.accuracy !== null && s.answered >= MIN_ANSWERED && s.accuracy < WEAK_FOR_PLAN).map((s) => s.skill),
      stats,
    );
    return (
      <Card className="mt-6" title="Study plan">
        <p className="text-sm">
          A day-by-day plan to your SAT, built for you: the topics you pick, at the right level, with short quizzes,
          full practice tests, words to learn and chapters to read. Every task opens straight onto its questions.
        </p>

        {!satAhead && (
          <div className="mt-5">
            <p className="mb-2 font-mono text-xs font-semibold tracking-tight uppercase">1. When is your SAT?</p>
            {upcoming.length === 0 ? (
              <p className="text-sm text-ink-soft">There are no upcoming SAT dates listed yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                {upcoming.map((d) => (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => setSatDate(d.date)}
                    className="press min-h-11 border-2 border-ink bg-paper px-3 py-2 font-mono text-sm font-semibold tracking-tight uppercase hover:bg-merino-dark"
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-5">
          <p className="mb-2 font-mono text-xs font-semibold tracking-tight uppercase">
            {satAhead ? 'Which topics do you want to work on?' : '2. Which topics do you want to work on?'}
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            <Button variant="secondary" disabled={weak.length === 0} onClick={() => setSelected(weak)}>
              My weak topics{weak.length > 0 ? ` (${weak.length})` : ''}
            </Button>
            <Button variant="secondary" onClick={() => setSelected(stats.map((s) => s.skill))}>
              Select all
            </Button>
            <Button variant="ghost" disabled={selected.length === 0} onClick={() => setSelected([])}>
              Clear
            </Button>
          </div>
          {weak.length === 0 && (
            <p className="mb-3 text-xs text-ink-soft">
              Answer at least {MIN_ANSWERED} questions in a topic and, if under {WEAK_FOR_PLAN}% are right, it shows up as
              weak here.
            </p>
          )}
          <TopicPicker selected={selected} onChange={setSelected} stats={stats} />
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Button
            className="flex-1 py-4 text-base"
            disabled={!satAhead || !isLoaded}
            onClick={() => {
              setStudyPlan(editing && planStart ? planStart : today, byNeed(selected, stats));
              setEditing(false);
              setShownDay(null);
            }}
          >
            {selected.length === 0 ? 'Make my plan: all topics' : `Make my plan: ${selected.length} topics`}
            {satAhead ? ` to ${satLabel(satDate!)}` : ''}
          </Button>
          {editing && (
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          )}
        </div>
      </Card>
    );
  }

  const day = plan.find((d) => d.date === (shownDay ?? today)) ?? plan.find((d) => !d.past) ?? plan[0];
  const ahead = plan.filter((d) => !d.past);
  const count = (kind: PlanDay['kind']) => ahead.filter((d) => d.kind === kind).length;
  const topicCount = result!.topics.length;
  const addedCount = result!.topics.filter((t) => !t.picked).length;
  const trendBadge: Record<Trend, string> = {
    new: 'bg-merino text-ink',
    struggling: 'bg-danger text-paper',
    mixed: 'bg-caution text-ink',
    solid: 'bg-rock-blue text-ink',
    mastered: 'bg-success text-paper',
  };
  // Topics with something to say: answered at all, or added for being missed.
  const explained = result!.topics.filter((t) => t.insight.recent.answered > 0 || !t.picked);

  return (
    <Card className="mt-6" title={`Study plan · SAT ${satLabel(satDate!)}`}>
      <p className="text-sm">
        <strong>{topicCount}</strong> {topicCount === 1 ? 'topic' : 'topics'} over{' '}
        <strong className="tabular-nums">{count('study') + count('quiz') + count('review')}</strong> study days, with{' '}
        <strong className="tabular-nums">{count('quiz')}</strong> mini tests and{' '}
        <strong className="tabular-nums">{count('test')}</strong> full practice tests.
        {addedCount > 0 && ` ${addedCount} ${addedCount === 1 ? 'topic was' : 'topics were'} added because you keep missing them.`}
      </p>

      <section className="mt-4 border-2 border-ink bg-merino-dark p-3" aria-label="Tasks">
        <p className="mb-3 font-mono text-xs font-bold tracking-tight uppercase">
          {day.date === today ? 'Today' : prettyDate(day.date)}
          {day.past && <span className="font-normal text-ink-soft"> · past</span>}
        </p>
        <ul className="flex flex-col gap-2">
          {day.tasks.map((task, i) => renderTask(task, `${day.date}-${i}`, day.date === today))}
        </ul>
        {day.date !== today && plan.some((d) => d.date === today) && (
          <button
            type="button"
            onClick={() => setShownDay(null)}
            className="mt-3 font-mono text-xs font-semibold text-venice-blue uppercase underline underline-offset-2"
          >
            Back to today
          </button>
        )}
      </section>

      {months(plan).map((month) => (
        <section key={month.label} className="mt-5">
          <h3 className="mb-2 font-mono text-xs font-bold tracking-tight uppercase">{month.label}</h3>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center font-mono text-[10px] font-semibold text-ink-soft uppercase">
                {d}
              </div>
            ))}
            {month.cells.map((cell, i) =>
              cell === null ? (
                <div key={`pad-${i}`} />
              ) : (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => setShownDay(cell.date)}
                  aria-label={`${prettyDate(cell.date)}: ${cellLabel(cell)}`}
                  aria-pressed={cell.date === day.date}
                  className={`min-h-16 border-2 px-1 py-0.5 text-left text-[10px] leading-tight sm:text-[11px] ${
                    cell.date === day.date ? 'border-coral outline-2 outline-coral' : cell.date === today ? 'border-coral' : 'border-ink'
                  } ${
                    cell.kind === 'sat'
                      ? 'bg-coral text-paper'
                      : cell.kind === 'test'
                        ? 'bg-venice-blue text-merino'
                        : cell.kind === 'quiz'
                          ? 'bg-rock-blue text-ink'
                          : 'bg-paper'
                  } ${cell.past ? 'opacity-40' : ''}`}
                >
                  <span className="block font-mono font-bold">{Number(cell.date.slice(8))}</span>
                  <span className="line-clamp-3 block break-words">{cellLabel(cell)}</span>
                </button>
              ),
            )}
          </div>
        </section>
      ))}

      <p className="mt-3 text-xs text-ink-soft">
        Tap a day to see its tasks. Dark blue: full practice test. Light blue: mini test. Targets update each day from
        what&apos;s left, so a missed day evens out.
      </p>

      <details className="mt-4 border-2 border-ink bg-paper px-3 py-2 text-sm" open={explained.length > 0 && explained.length <= 6}>
        <summary className="cursor-pointer font-mono text-xs font-bold uppercase">What your mistakes show</summary>
        <p className="mt-2 text-xs text-ink-soft">
          Worked out every morning from your answers, in practice, mini tests and full tests, and used to set
          the day&apos;s plan: how often each topic comes up, at what level, and which missed questions to redo.
        </p>
        {explained.length === 0 ? (
          <p className="mt-2">Answer some questions in your topics and this fills in.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {explained.map(({ insight, picked }) => (
              <li key={insight.skill} className="border-t-2 border-merino-dark pt-2">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{insight.skill}</span>
                  <span className={`border-2 border-ink px-1.5 font-mono text-[10px] font-bold uppercase ${trendBadge[insight.trend]}`}>
                    {insight.trend === 'new' ? 'Too early to tell' : insight.trend}
                  </span>
                  {!picked && <span className="font-mono text-[10px] font-bold text-danger uppercase">Added</span>}
                </p>
                <p className="mt-0.5 text-xs">{describeInsight(insight, picked)}</p>
              </li>
            ))}
          </ul>
        )}
      </details>

      <details className="mt-4 border-2 border-ink bg-paper px-3 py-2 text-sm">
        <summary className="cursor-pointer font-mono text-xs font-bold uppercase">Why this plan works</summary>
        <ul className="mt-2 list-disc pl-5">
          <li>
            <strong>Spaced practice:</strong> each topic comes back every few days, and your weakest twice as often,
            instead of being crammed in one go.
          </li>
          <li>
            <strong>Mixing topics:</strong> two different topics a day, alternating Reading and Writing with Math.
          </li>
          <li>
            <strong>Testing yourself:</strong> a mini test every Wednesday on what you&apos;ve practised, and full
            practice tests: every other week, then weekly in the last three weeks.
          </li>
          <li>
            <strong>Learning from mistakes:</strong> the day after each full test is for going over what you missed.
          </li>
          <li>
            <strong>Following your mistakes:</strong> topics you&apos;re getting wrong come up more, at the level where
            your mistakes are, and the questions you missed come back to redo. Topics you&apos;ve mastered come up less.
          </li>
          <li>
            <strong>A light last day,</strong> so you go into the SAT rested.
          </li>
        </ul>
        <p className="mt-2 text-xs text-ink-soft">
          Based on{' '}
          <a className="text-venice-blue underline" href="https://www.aft.org/ae/fall2013/dunlosky" target="_blank" rel="noreferrer">
            Dunlosky et al., the study of which study techniques work best
          </a>{' '}
          (practice testing and spaced practice rated highest), and{' '}
          <a
            className="text-venice-blue underline"
            href="https://satsuite.collegeboard.org/practice/build-your-study-plan"
            target="_blank"
            rel="noreferrer"
          >
            College Board&apos;s advice on building an SAT study plan
          </a>
          .
        </p>
      </details>

      <div className="mt-4 flex flex-wrap gap-4">
        <button
          type="button"
          onClick={() => {
            setSelected(planSkills ?? []);
            setEditing(true);
          }}
          className="font-mono text-xs font-semibold tracking-tight text-venice-blue uppercase underline underline-offset-2"
        >
          Change topics
        </button>
        <button
          type="button"
          onClick={() => setConfirmRemove(true)}
          className="font-mono text-xs font-semibold tracking-tight text-venice-blue uppercase underline underline-offset-2"
        >
          Remove plan
        </button>
      </div>

      <ConfirmDialog
        open={confirmRemove}
        title="Remove the plan?"
        confirmLabel="Remove"
        onConfirm={() => {
          setConfirmRemove(false);
          setStudyPlan(undefined);
        }}
        onCancel={() => setConfirmRemove(false)}
      >
        <p>Your progress isn&apos;t affected. You can make a new plan any time.</p>
      </ConfirmDialog>
    </Card>
  );
}

