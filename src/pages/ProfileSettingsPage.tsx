import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { AvatarPicker } from '../components/profile/AvatarPicker';
import { AccountCard } from '../components/profile/AccountCard';
import { useSettingsStore } from '../store/useSettingsStore';
import { useProgressStore } from '../store/useProgressStore';
import { useAccountStore } from '../store/useAccountStore';
import { DEFAULT_AVATARS } from '../types/settings';

export function ProfileSettingsPage() {
  const profile = useSettingsStore((s) => s.profile);
  const saveProfile = useSettingsStore((s) => s.saveProfile);
  const signedIn = useAccountStore((s) => s.user !== null);
  const { stats, bundledCount, importedCount, resetProgress } = useProgressStore();

  const [nickname, setNickname] = useState(profile?.nickname ?? '');
  const [avatar, setAvatar] = useState<string>(profile?.avatar ?? DEFAULT_AVATARS[0]);

  // Sync form fields once the profile loads from storage (it may not be ready on first paint).
  useEffect(() => {
    if (profile) {
      setNickname(profile.nickname);
      setAvatar(profile.avatar);
    }
  }, [profile]);

  const trimmedNickname = nickname.trim();
  const hasChanges =
    trimmedNickname !== (profile?.nickname ?? '') || avatar !== (profile?.avatar ?? DEFAULT_AVATARS[0]);
  const accuracy =
    stats.questionsAttempted > 0 ? Math.round((stats.correctCount / stats.questionsAttempted) * 100) : 0;

  function handleSave() {
    if (!trimmedNickname) return;
    saveProfile(trimmedNickname, avatar);
  }

  function handleResetAll() {
    if (window.confirm('Reset ALL progress? Every question will return to unattempted. This cannot be undone.')) {
      resetProgress('all');
    }
  }

  const statEntries: { label: string; value: string | number }[] = [
    { label: 'Points', value: stats.points },
    { label: 'Attempted', value: stats.questionsAttempted },
    { label: 'Correct', value: stats.correctCount },
    { label: 'Accuracy', value: `${accuracy}%` },
    { label: 'Streak', value: stats.currentStreak },
    { label: 'Best streak', value: stats.bestStreak },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <Link
        to="/"
        className="mb-4 inline-block text-xs font-semibold tracking-tight text-venice-blue uppercase hover:underline"
      >
        ← Home
      </Link>
      <h1 className="mb-5 text-2xl leading-none font-bold tracking-tight uppercase sm:text-3xl">
        Profile & settings
      </h1>

      <AccountCard />

      <Card className="mb-4" title={signedIn ? 'Profile' : 'Local profile'}>
        <p className="mb-4 text-sm text-ink-soft">
          {signedIn
            ? 'Saved to your account along with your progress.'
            : 'Stored only in this browser. Clearing your browser data removes it; sign in to keep it in your account instead.'}
        </p>

        <label className="mb-4 block">
          <span className="mb-1.5 block text-xs font-semibold tracking-tight text-ink-soft uppercase">
            Nickname
          </span>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Enter a nickname"
            className="min-h-11 w-full border-2 border-ink bg-paper px-3 py-2 text-sm"
          />
        </label>

        <div className="mb-4">
          <span className="mb-1.5 block text-xs font-semibold tracking-tight text-ink-soft uppercase">
            Avatar
          </span>
          <AvatarPicker selected={avatar} onSelect={setAvatar} />
        </div>

        <Button onClick={handleSave} disabled={!trimmedNickname || !hasChanges}>
          {profile && !hasChanges ? 'Saved' : 'Save'}
        </Button>
      </Card>

      <Card
        className="mb-4"
        title="Your stats"
        titleRight={
          <span className="text-[11px] font-semibold tracking-tight text-merino tabular-nums">
            {bundledCount} demo · {importedCount} imported
          </span>
        }
      >
        {/* 2px gaps over an ink background draw the rules, so cells stay aligned as they wrap. */}
        <dl className="grid grid-cols-2 gap-[2px] border-2 border-ink bg-ink sm:grid-cols-3">
          {statEntries.map((stat) => (
            <div key={stat.label} className="bg-merino-dark px-3 py-2.5">
              <dt className="text-[10px] font-semibold tracking-tight text-ink-soft uppercase">{stat.label}</dt>
              <dd className="text-xl font-bold tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="mb-4" title="Question bank">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-soft">Import your own question bank, or replace the current one.</p>
          <Link to="/import" className="flex-none">
            <Button variant="secondary" className="w-full sm:w-auto">
              Manage
            </Button>
          </Link>
        </div>
      </Card>

      {/* Destructive, so it gets the loudest frame on the page. */}
      <div className="border-2 border-danger bg-danger-bg shadow-[4px_4px_0_var(--color-danger)]">
        <div className="border-b-2 border-danger bg-danger px-3 py-1.5 text-xs font-semibold tracking-tight text-paper uppercase">
          Danger zone
        </div>
        <div className="p-4">
          <p className="mb-3 text-sm text-ink">
            Moves every question back to unattempted, clearing your Wrong and Right lists. Points and
            streaks are not affected.
          </p>
          <Button variant="danger" onClick={handleResetAll}>
            Reset all progress
          </Button>
        </div>
      </div>
    </div>
  );
}
