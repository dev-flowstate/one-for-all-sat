import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { LeaderboardEntry } from '../lib/cloud/firebaseClient';
import { useAccountStore } from '../store/useAccountStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

type Row = LeaderboardEntry & { uid: string };

/** How many entries are shown. */
const TOP = 100;

/** The top three get a coloured rank, the way a podium would. */
const PODIUM = ['bg-coral text-paper', 'bg-venice-blue text-merino', 'bg-rock-blue text-ink'];

/**
 * Every signed-in student, ranked by how many questions they've answered. Entries hold only a
 * nickname, an avatar and two counts; they update as people practise.
 */
export function LeaderboardPage() {
  const { status, user, ready, error, signIn, prepare, fetchLeaderboard } = useAccountStore();
  const hidden = useSettingsStore((s) => s.profile?.hideFromLeaderboard === true);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    prepare();
    let live = true;
    fetchLeaderboard(TOP)
      // Ties on questions answered go to whoever got more right.
      .then((list) => live && setRows([...list].sort((a, b) => b.answered - a.answered || b.correct - a.correct)))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [prepare, fetchLeaderboard]);

  const signedOut = status !== 'off' && status !== 'checking' && !user;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <Link to="/" className="mb-4 inline-block text-xs font-semibold tracking-tight text-venice-blue uppercase hover:underline">
        ← Home
      </Link>
      <h1 className="mb-2 text-2xl leading-none font-bold tracking-tight uppercase sm:text-3xl">Leaderboard</h1>
      <p className="mb-5 text-sm text-ink-soft">
        Signed-in students, ranked by how many questions they&apos;ve answered. Only nicknames and avatars are shown.
      </p>

      {signedOut && (
        <div className="mb-5 flex flex-col gap-3 border-2 border-ink bg-venice-blue px-4 py-4 text-merino shadow-[4px_4px_0_var(--color-ink)] sm:flex-row sm:items-center">
          <p className="flex-1 text-sm font-semibold">Sign in with Google to get on the board.</p>
          <Button variant="secondary" className="flex-none" disabled={!ready} onClick={() => void signIn()}>
            {ready ? 'Sign in with Google' : 'Getting ready…'}
          </Button>
        </div>
      )}
      {signedOut && error && <p className="-mt-3 mb-5 text-sm font-semibold text-danger">{error}</p>}
      {user && hidden && (
        <p className="mb-5 border-2 border-ink bg-merino-dark px-3 py-2 text-sm">
          You&apos;re hidden from the leaderboard.{' '}
          <Link to="/profile" className="font-semibold text-venice-blue underline underline-offset-2">
            Change this in Profile
          </Link>
          .
        </p>
      )}

      <Card title="Most questions answered" titleRight={rows && <span className="font-mono text-xs text-merino">[{rows.length}]</span>}>
        {failed ? (
          <p className="text-sm text-ink-soft">Couldn&apos;t load the leaderboard. Check your connection and try again.</p>
        ) : rows === null ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-ink-soft">No one&apos;s on the board yet. Sign in and answer a question to be first.</p>
        ) : (
          <ol>
            {rows.map((row, i) => {
              const me = row.uid === user?.uid;
              const share = row.answered > 0 ? Math.round((row.correct / row.answered) * 100) : 0;
              return (
                <li
                  key={row.uid}
                  className={`flex items-center gap-3 border-t-2 border-merino-dark py-2.5 first:border-t-0 ${
                    me ? '-mx-2 bg-merino px-2' : ''
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 flex-none items-center justify-center border-2 border-ink font-mono text-sm font-bold tabular-nums ${
                      PODIUM[i] ?? 'bg-paper text-ink'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span aria-hidden="true" className="text-xl leading-none">
                    {row.avatar}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {row.name}
                    {me && (
                      <span className="ml-2 border-2 border-ink bg-venice-blue px-1.5 font-mono text-[10px] font-bold text-merino uppercase">
                        You
                      </span>
                    )}
                  </span>
                  <span className="flex-none text-right">
                    <span className="block font-mono text-lg font-bold tabular-nums">{row.answered}</span>
                    <span className="block font-mono text-[11px] text-ink-soft tabular-nums">{share}% right</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </div>
  );
}
