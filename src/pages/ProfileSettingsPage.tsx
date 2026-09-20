import { Card } from '../components/ui/Card';

/**
 * OWNER: Phase 1 Track C5.
 * Local nickname/avatar via useSettingsStore (explicitly labeled as a local
 * profile, not a sign-in — no real auth exists). Show stats from
 * useProgressStore().stats. Pick from src/types/settings.ts#DEFAULT_AVATARS.
 */
export function ProfileSettingsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Card>
        <p className="text-sm text-venice-blue-dark/70">Profile & settings — coming soon.</p>
      </Card>
    </div>
  );
}
