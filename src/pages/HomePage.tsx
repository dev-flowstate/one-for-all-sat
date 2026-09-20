import { Link } from 'react-router-dom';
import { useProgressStore } from '../store/useProgressStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { getMainPool, getWrongPool, getRightPool } from '../lib/pools';

export function HomePage() {
  const { questions, progress, stats, isLoaded, bundledCount, importedCount } = useProgressStore();
  const profile = useSettingsStore((s) => s.profile);

  const mainCount = getMainPool(questions, progress).length;
  const wrongCount = getWrongPool(questions, progress).length;
  const rightCount = getRightPool(questions, progress).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-venice-blue-dark">One for All SAT</h1>
        <p className="mt-2 text-venice-blue-dark/70">
          {profile ? `Welcome back, ${profile.avatar} ${profile.nickname}` : 'Your personal SAT practice space'}
        </p>
      </header>

      {!isLoaded ? (
        <p className="text-center text-venice-blue-dark/60">Loading your question bank…</p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-3 text-center">
            <Card>
              <p className="text-2xl font-bold text-venice-blue">{mainCount}</p>
              <p className="text-xs text-venice-blue-dark/70">Unattempted</p>
            </Card>
            <Card>
              <p className="text-2xl font-bold text-danger">{wrongCount}</p>
              <p className="text-xs text-venice-blue-dark/70">Wrong</p>
            </Card>
            <Card>
              <p className="text-2xl font-bold text-success">{rightCount}</p>
              <p className="text-xs text-venice-blue-dark/70">Right</p>
            </Card>
          </div>

          <Card className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-venice-blue-dark/70">Total points</p>
              <p className="text-xl font-bold text-venice-blue">{stats.points}</p>
            </div>
            <div className="text-right text-sm text-venice-blue-dark/70">
              <p>
                {bundledCount} demo + {importedCount} imported questions
              </p>
              <p>Best streak: {stats.bestStreak}</p>
            </div>
          </Card>

          {importedCount === 0 && (
            <Card className="mb-6 border-venice-blue/40 bg-rock-blue/10">
              <p className="text-sm">
                You&apos;re practicing with the small original demo set.{' '}
                <Link to="/import" className="font-semibold text-venice-blue underline">
                  Import your own question bank
                </Link>{' '}
                to unlock your full library.
              </p>
            </Card>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/setup" className="flex-1">
              <Button className="w-full" variant="primary">
                Start practicing
              </Button>
            </Link>
            <Link to="/wrong" className="flex-1">
              <Button className="w-full" variant="secondary">
                Review wrong ({wrongCount})
              </Button>
            </Link>
            <Link to="/profile" className="flex-1">
              <Button className="w-full" variant="ghost">
                Profile & settings
              </Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
