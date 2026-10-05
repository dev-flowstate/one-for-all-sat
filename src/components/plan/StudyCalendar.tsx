import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProgressStore } from '../../store/useProgressStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useVocabStore } from '../../store/useVocabStore';
import { getMainPool } from '../../lib/pools';
import { buildPlan, isOn, localDate, weekday, type PlanDay } from '../../lib/studyPlan';
import { VOCAB_CARD_COUNT } from '../../data/vocab/count';
import { satLabel, satStart, upcomingSatDates } from '../../data/satDates';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The plan's days grouped by month, each month padded to start on a Monday. */
function months(days: PlanDay[]): { label: string; cells: (PlanDay | null)[] }[] {
  const out: { label: string; cells: (PlanDay | null)[] }[] = [];
  for (const day of days) {
    const [y, m] = day.date.split('-').map(Number);
    const label = new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    let month = out.at(-1);
    if (month?.label !== label) {
      // Monday first: Sunday (0) goes last.
      month = { label, cells: Array((weekday(day.date) + 6) % 7).fill(null) };
      out.push(month);
    }
    month.cells.push(day);
  }
  return out;
}

/** "12 / 34", with a bar, for one of today's targets. */
function Target({ label, done, target }: { label: string; done: number; target: number }) {
  const share = target === 0 ? 1 : Math.min(1, done / target);
  return (
    <div>
      <div className="flex items-baseline justify-between font-mono text-xs font-semibold tracking-tight uppercase">
        <span>{label}</span>
        <span className="tabular-nums">
          {Math.min(done, target)} / {target}
        </span>
      </div>
      <div className="mt-1 h-3 border-2 border-ink bg-paper">
        <div className={`h-full ${share >= 1 ? 'bg-success' : 'bg-venice-blue'}`} style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  );
}

/**
 * The home screen's study calendar. Spreads the unattempted questions and unlearned words over
 * the days left before the SAT, with a practice test every Saturday, and shows today's share.
 */
export function StudyCalendar() {
  const satDate = useSettingsStore((s) => s.profile?.satDate);
  const planStart = useSettingsStore((s) => s.profile?.studyPlanStart);
  const { setSatDate, setStudyPlanStart } = useSettingsStore.getState();
  const questions = useProgressStore((s) => s.questions);
  const progress = useProgressStore((s) => s.progress);
  const isLoaded = useProgressStore((s) => s.isLoaded);
  const vocab = useVocabStore((s) => s.progress);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const today = localDate(new Date());
  const satAhead = satDate !== undefined && satStart(satDate) > new Date();

  // What was done today, so today's targets are worked out from what was left this morning and
  // don't shrink as the day's work gets done. A question counts on the day it was first answered.
  const work = useMemo(() => {
    const questionsToday = Object.values(progress).filter((s) => s.attempts === 1 && isOn(s.lastAttemptedAt, today)).length;
    const wordsToday = Object.values(vocab).filter((s) => s.status !== 'unseen' && s.reviews === 1 && isOn(s.lastReviewedAt, today)).length;
    const wordsSeen = Object.values(vocab).filter((s) => s.status !== 'unseen').length;
    return {
      questionsToday,
      wordsToday,
      questionsLeft: getMainPool(questions, progress).length + questionsToday,
      wordsLeft: Math.max(0, VOCAB_CARD_COUNT - wordsSeen) + wordsToday,
    };
  }, [questions, progress, vocab, today]);

  const plan = useMemo(
    () => (planStart && satDate && satAhead ? buildPlan(planStart, today, satDate, work.questionsLeft, work.wordsLeft) : null),
    [planStart, satDate, satAhead, today, work.questionsLeft, work.wordsLeft],
  );

  if (!planStart || !plan) {
    const upcoming = upcomingSatDates();
    return (
      <Card className="mt-6" title="Study calendar">
        <p className="text-sm">
          Spreads every question you haven&apos;t done and every word you haven&apos;t learned over the days left before
          your SAT, with a full practice test every Saturday. It recalculates each day from what&apos;s left, so a missed
          day evens out.
        </p>
        {!satAhead && (
          <div className="mt-4">
            <p className="mb-2 font-mono text-xs font-semibold tracking-tight uppercase">When is your SAT?</p>
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
        <Button className="mt-5 w-full py-4 text-base" disabled={!satAhead || !isLoaded} onClick={() => setStudyPlanStart(today)}>
          {satAhead ? `Make my calendar to ${satLabel(satDate!)}` : 'Make my calendar'}
        </Button>
      </Card>
    );
  }

  const todayPlan = plan.find((d) => d.date === today);
  const studyDaysLeft = plan.filter((d) => !d.past && d.kind === 'study').length;
  const testsLeft = plan.filter((d) => !d.past && d.kind === 'test').length;

  return (
    <Card className="mt-6" title={`Study calendar · SAT ${satLabel(satDate!)}`}>
      <p className="text-sm">
        <strong className="tabular-nums">{work.questionsLeft}</strong> questions and{' '}
        <strong className="tabular-nums">{work.wordsLeft}</strong> words over{' '}
        <strong className="tabular-nums">{studyDaysLeft}</strong> study {studyDaysLeft === 1 ? 'day' : 'days'}, plus{' '}
        <strong className="tabular-nums">{testsLeft}</strong> practice {testsLeft === 1 ? 'test' : 'tests'} on Saturdays.
      </p>

      {todayPlan && (
        <div className="mt-4 border-2 border-ink bg-merino-dark p-3">
          <p className="mb-3 font-mono text-xs font-bold tracking-tight uppercase">Today</p>
          {todayPlan.kind === 'sat' ? (
            <p className="text-sm font-semibold">It&apos;s SAT day. Good luck!</p>
          ) : todayPlan.kind === 'test' ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm">Saturday: take a full practice test.</p>
              <Link to="/tests">
                <Button className="w-full sm:w-auto">Practice tests</Button>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Target label="Questions" done={work.questionsToday} target={todayPlan.questions} />
              <Target label="Words" done={work.wordsToday} target={todayPlan.words} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Link to="/setup">
                  <Button className="w-full">Practice questions</Button>
                </Link>
                <Link to="/vocab">
                  <Button variant="secondary" className="w-full">
                    Learn words
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {months(plan).map((month) => (
        <section key={month.label} className="mt-5">
          <h3 className="mb-2 font-mono text-xs font-bold tracking-tight uppercase">{month.label}</h3>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center font-mono text-[10px] font-semibold text-ink-soft uppercase">
                {d}
              </div>
            ))}
            {month.cells.map((day, i) =>
              day === null ? (
                <div key={`pad-${i}`} />
              ) : (
                <div
                  key={day.date}
                  aria-label={
                    day.kind === 'sat'
                      ? `${day.date}: SAT`
                      : day.kind === 'test'
                        ? `${day.date}: practice test`
                        : day.past
                          ? `${day.date}: past`
                          : `${day.date}: ${day.questions} questions, ${day.words} words`
                  }
                  className={`min-h-14 border-2 px-1 py-0.5 text-[10px] leading-tight sm:min-h-16 sm:text-xs ${
                    day.date === today ? 'border-coral' : 'border-ink'
                  } ${
                    day.kind === 'sat'
                      ? 'bg-coral text-paper'
                      : day.kind === 'test'
                        ? 'bg-venice-blue text-merino'
                        : 'bg-paper'
                  } ${day.past ? 'opacity-40' : ''}`}
                >
                  <span className="block font-mono font-bold">{Number(day.date.slice(8))}</span>
                  {day.kind === 'sat' ? (
                    <span className="block font-mono font-bold">SAT</span>
                  ) : day.kind === 'test' ? (
                    <span className="block font-mono font-bold">Test</span>
                  ) : (
                    !day.past && (
                      <span className="block tabular-nums">
                        {day.questions}q
                        <br />
                        {day.words}w
                      </span>
                    )
                  )}
                </div>
              ),
            )}
          </div>
        </section>
      ))}

      <p className="mt-3 text-xs text-ink-soft">q = questions, w = words. Blue days are practice tests.</p>
      <button
        type="button"
        onClick={() => setConfirmRemove(true)}
        className="mt-3 font-mono text-xs font-semibold tracking-tight text-venice-blue uppercase underline underline-offset-2"
      >
        Remove calendar
      </button>

      <ConfirmDialog
        open={confirmRemove}
        title="Remove the calendar?"
        confirmLabel="Remove"
        onConfirm={() => {
          setConfirmRemove(false);
          setStudyPlanStart(undefined);
        }}
        onCancel={() => setConfirmRemove(false)}
      >
        <p>Your progress isn&apos;t affected. You can make a new calendar any time.</p>
      </ConfirmDialog>
    </Card>
  );
}
