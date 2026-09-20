import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { AvatarPicker } from '../components/profile/AvatarPicker';
import { useSettingsStore } from '../store/useSettingsStore';
import { useProgressStore } from '../store/useProgressStore';
import { DEFAULT_AVATARS } from '../types/settings';

export function ProfileSettingsPage() {
  const profile = useSettingsStore((s) => s.profile);
  const saveProfile = useSettingsStore((s) => s.saveProfile);
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link to="/" className="mb-4 inline-block text-sm text-venice-blue hover:underline">
        ← Home
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-venice-blue-dark">Profile & settings</h1>

      <Card className="mb-6">
        <h2 className="mb-1 text-lg font-semibold text-venice-blue-dark">Local profile</h2>
        <p className="mb-4 text-sm text-venice-blue-dark/70">
          This is a local profile stored only in this browser — not a real account. No password, no server, no
          syncing across devices. Clearing your browser data will remove it.
        </p>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium text-venice-blue-dark">Nickname</span>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Enter a nickname"
            className="w-full rounded-lg border border-rock-blue-dark/40 bg-white/80 px-3 py-2 text-sm text-venice-blue-dark focus:border-venice-blue focus:outline-none"
          />
        </label>

        <div className="mb-4">
          <span className="mb-1 block text-sm font-medium text-venice-blue-dark">Avatar</span>
          <AvatarPicker selected={avatar} onSelect={setAvatar} />
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={!trimmedNickname || !hasChanges}>
            {profile && !hasChanges ? 'Saved' : 'Save'}
          </Button>
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-3 text-lg font-semibold text-venice-blue-dark">Your stats</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatBlock label="Points" value={stats.points} />
          <StatBlock label="Attempted" value={stats.questionsAttempted} />
          <StatBlock label="Correct" value={stats.correctCount} />
          <StatBlock label="Accuracy" value={`${accuracy}%`} />
          <StatBlock label="Current streak" value={stats.currentStreak} />
          <StatBlock label="Best streak" value={stats.bestStreak} />
        </div>
        <p className="mt-4 text-sm text-venice-blue-dark/70">
          {bundledCount} demo · {importedCount} imported question{importedCount === 1 ? '' : 's'} loaded
        </p>
      </Card>

      <Card className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-venice-blue-dark">Question bank</h2>
          <p className="text-sm text-venice-blue-dark/70">Import your own question bank or replace it.</p>
        </div>
        <Link to="/import">
          <Button variant="secondary" className="w-full sm:w-auto">
            Manage
          </Button>
        </Link>
      </Card>

      <Card className="border-danger/40 bg-danger-bg/30">
        <h2 className="mb-1 text-lg font-semibold text-danger">Danger zone</h2>
        <p className="mb-3 text-sm text-venice-blue-dark/70">
          Moves every question back to unattempted, clearing your Wrong and Right lists. Points and streaks are not
          affected.
        </p>
        <Button variant="danger" onClick={handleResetAll}>
          Reset ALL progress
        </Button>
      </Card>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-2xl font-bold text-venice-blue">{value}</p>
      <p className="text-xs text-venice-blue-dark/70">{label}</p>
    </div>
  );
}
