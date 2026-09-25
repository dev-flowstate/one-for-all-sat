import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useProgressStore } from '../store/useProgressStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { usePracticeTestStore } from '../store/usePracticeTestStore';
import { Button } from '../components/ui/Button';
import { testName } from '../lib/practiceTest/format';
import { getMainPool, getWrongPool, getRightPool } from '../lib/pools';
import { MIN_ANSWERED, rankWeakest, skillStats } from '../lib/topicStats';
import { Card } from '../components/ui/Card';
import { TopicRow } from '../components/topics/TopicRow';
import { SignInBanner } from '../components/profile/SignInBanner';

export function HomePage() {
  const { questions, progress, stats, isLoaded, bundledCount, importedCount } = useProgressStore();
  const profile = useSettingsStore((s) => s.profile);
  const activeTest = usePracticeTestStore((s) => s.active);

  const mainCount = getMainPool(questions, progress).length;
  const wrongCount = getWrongPool(questions, progress).length;
  const rightCount = getRightPool(questions, progress).length;
  const weakest = useMemo(() => rankWeakest(skillStats(questions, progress)).slice(0, 3), [questions, progress]);

  /* The three pools are what a returning user scans first, so they get the loudest
     treatment on the page: a solid colour-coded cap over an oversized figure. */
  const pools = [
    { label: 'Unattempted', value: mainCount, cap: 'bg-rock-blue text-ink' },
    { label: 'Wrong', value: wrongCount, cap: 'bg-danger text-paper' },
    { label: 'Right', value: rightCount, cap: 'bg-success text-paper' },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
      <header className="panel-raised">
        {/* Status bar: where you are, and how big the bank is. */}
        <div className="flex items-center gap-2 border-b-2 border-ink bg-ink px-3 py-1.5">
          <span aria-hidden="true" className="flex gap-1">
            <span className="block h-2.5 w-2.5 border-2 border-merino" />
            <span className="block h-2.5 w-2.5 border-2 border-merino" />
          </span>
          <span className="flex-1 truncate text-[11px] font-semibold tracking-tight text-merino uppercase">
            Home
          </span>
          <span className="text-[11px] font-semibold tracking-tight text-merino uppercase tabular-nums">
            {bundledCount + importedCount} questions
          </span>
        </div>

        <div className="relative px-4 py-6 sm:px-6 sm:py-8">
          <Link
            to="/leaderboard"
            aria-label="Leaderboard"
            className="press absolute top-4 right-4 flex items-center gap-2 border-2 border-ink bg-paper px-2.5 py-2 font-mono text-xs font-bold tracking-tight uppercase shadow-[4px_4px_0_var(--color-ink)] hover:bg-merino-dark sm:top-6 sm:right-6"
          >
            {/* A trophy, drawn square-cornered to match the rest of the chrome. */}
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-6 w-6 flex-none text-coral"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="square"
              strokeLinejoin="miter"
            >
              <path d="M7 3h10v6a5 5 0 0 1-10 0z" fill="currentColor" fillOpacity="0.25" />
              <path d="M7 5H3v2a4 4 0 0 0 4 4M17 5h4v2a4 4 0 0 1-4 4M12 14v4M8 21h8v-3H8z" />
            </svg>
            <span className="hidden sm:inline">Leaderboard</span>
          </Link>
          <p className="text-[11px] font-semibold tracking-tight text-ink-soft uppercase">Digital SAT practice</p>
          <h1 className="mt-2 text-3xl leading-none font-bold tracking-tight uppercase sm:text-5xl">
            One for all <span className="inline-block bg-venice-blue px-2 py-1 text-merino">SAT</span>
          </h1>
          <p className="mt-4 text-sm text-ink-soft">
            {profile ? `Welcome back, ${profile.avatar} ${profile.nickname}` : 'Your personal SAT practice space'}
          </p>
        </div>
      </header>

      <SignInBanner />

      {/* Rendered whether or not storage has answered yet, with placeholders standing in for
          the numbers. Swapping a short "loading" block for the full layout grew the page by
          ~380px on every visit, which is a visible jolt and the app's whole CLS score. */}
      {(() => {
        const placeholder = '—';
        return (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3 sm:mt-6 sm:gap-4">
            {pools.map((pool) => (
              <div key={pool.label} className="panel">
                <p
                  className={`border-b-2 border-ink px-2 py-1 text-center text-[10px] font-semibold tracking-tight uppercase sm:text-[11px] ${pool.cap}`}
                >
                  {pool.label}
                </p>
                <p className="px-2 py-4 text-center text-3xl font-bold tabular-nums sm:py-6 sm:text-5xl">
                  {isLoaded ? pool.value : placeholder}
                </p>
              </div>
            ))}
          </div>

          {/* 2px gaps over an ink background draw the rules, so the cells stay aligned
              however they wrap. */}
          <dl className="mt-3 grid grid-cols-2 gap-[2px] border-2 border-ink bg-ink sm:mt-4 sm:grid-cols-3">
            <div className="bg-merino-dark px-3 py-2.5">
              <dt className="text-[10px] font-semibold tracking-tight text-ink-soft uppercase">Total points</dt>
              <dd className="text-lg font-bold tabular-nums">{isLoaded ? stats.points : placeholder}</dd>
            </div>
            <div className="bg-merino-dark px-3 py-2.5">
              <dt className="text-[10px] font-semibold tracking-tight text-ink-soft uppercase">Best streak</dt>
              <dd className="text-lg font-bold tabular-nums">{isLoaded ? stats.bestStreak : placeholder}</dd>
            </div>
            <div className="col-span-2 bg-merino-dark px-3 py-2.5 sm:col-span-1">
              <dt className="text-[10px] font-semibold tracking-tight text-ink-soft uppercase">Question bank</dt>
              <dd className="text-sm font-semibold tabular-nums">
                {isLoaded ? `${bundledCount} demo + ${importedCount} imported` : placeholder}
              </dd>
            </div>
          </dl>

          <div className="mt-4 sm:mt-6">
            <Link to="/setup" className="block">
              <Button variant="primary" className="w-full py-4 text-base sm:py-5 sm:text-lg">
                Start practicing
              </Button>
            </Link>
            <Link to="/tests" className="mt-3 block">
              <Button variant="secondary" className="w-full py-4 text-base">
                {activeTest ? `Resume ${testName(activeTest)}` : 'Full-length practice test'}
              </Button>
            </Link>
            {/* Vocabulary is its own section with its own decks and progress, so it gets its
                own full-width entry rather than sitting in the row of secondary links. */}
            <Link to="/vocab" className="mt-3 block">
              <Button variant="secondary" className="w-full py-4 text-base">
                Vocabulary flashcards
              </Button>
            </Link>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Link to="/wrong" className="block">
                <Button className="w-full" variant="secondary">
                  Review wrong {isLoaded ? `(${wrongCount})` : ''}
                </Button>
              </Link>
              <Link to="/profile" className="block">
                <Button className="w-full" variant="ghost">
                  Profile & settings
                </Button>
              </Link>
            </div>
          </div>

          {isLoaded && (
            <Card
              className="mt-6"
              title="Weakest topics"
              titleRight={
                <Link to="/topics" className="font-mono text-[11px] font-semibold text-merino underline underline-offset-2">
                  All topics
                </Link>
              }
            >
              {weakest.length === 0 ? (
                <p className="text-sm text-ink-soft">
                  Answer {MIN_ANSWERED} questions in a subtopic and it shows up here, ranked from weakest to strongest.
                </p>
              ) : (
                <ol>
                  {weakest.map((stat, i) => (
                    <TopicRow key={stat.skill} stat={stat} rank={i + 1} />
                  ))}
                </ol>
              )}
            </Card>
          )}

          {/* Gated on isLoaded too: importedCount is 0 before storage answers, so without it
              the banner flashes in and out on every visit that does have a bank. */}
          {isLoaded && importedCount === 0 && (
            <div className="mt-4 flex flex-col gap-2 border-2 border-ink bg-merino-dark p-3 sm:flex-row sm:items-center sm:gap-3">
              <span className="w-fit border-2 border-ink bg-venice-blue px-2 py-0.5 text-[11px] font-semibold tracking-tight text-merino uppercase">
                Demo set
              </span>
              <p className="text-sm">
                You&apos;re practicing with the small original demo set.{' '}
                <Link to="/import" className="font-semibold text-venice-blue underline underline-offset-2">
                  Import your own question bank
                </Link>{' '}
                to unlock your full library.
              </p>
            </div>
          )}
        </>
        );
      })()}

      <footer className="mt-10 border-t-2 border-ink pt-4 text-center text-[11px] font-semibold tracking-tight text-ink-soft uppercase">
        Made by Muhammad Salar Khan
      </footer>
    </div>
  );
}
