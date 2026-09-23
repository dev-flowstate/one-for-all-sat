import { useState } from 'react';
import { useAccountStore } from '../../store/useAccountStore';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';

const STATUS_TEXT: Record<string, string> = {
  checking: 'Checking your sign-in…',
  syncing: 'Saving…',
  synced: 'Progress saved to your account',
};

/** Signing in with Google, so progress follows you between devices. */
export function AccountCard() {
  const { status, user, error, signIn, signOut, retry } = useAccountStore();
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  if (status === 'off') return null;

  return (
    <Card className="mb-4" title="Account">
      {user ? (
        <>
          <div className="flex items-center gap-3">
            {user.photoUrl && (
              <img
                src={user.photoUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="h-11 w-11 flex-none border-2 border-ink"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{user.name ?? user.email}</p>
              {user.name && <p className="truncate text-sm text-ink-soft">{user.email}</p>}
            </div>
          </div>
          <p className="mt-3 font-mono text-xs font-semibold tracking-tight text-ink-soft uppercase" role="status">
            {status === 'error' ? '' : STATUS_TEXT[status]}
          </p>
          {error && (
            <p className="mt-2 text-sm font-semibold text-danger">
              {error}{' '}
              <button type="button" onClick={retry} className="underline underline-offset-2">
                Try again
              </button>
            </p>
          )}
          <Button variant="ghost" className="mt-3" onClick={() => setConfirmSignOut(true)}>
            Sign out
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm">
            Sign in with Google to save your progress to your account, so it follows you to any device. Signing in is
            optional: without it, progress stays in this browser only.
          </p>
          {status === 'checking' && (
            <p className="mt-3 font-mono text-xs font-semibold tracking-tight text-ink-soft uppercase" role="status">
              {STATUS_TEXT.checking}
            </p>
          )}
          {error && <p className="mt-3 text-sm font-semibold text-danger">{error}</p>}
          <Button className="mt-4" onClick={() => void signIn()} disabled={status === 'checking'}>
            Sign in with Google
          </Button>
        </>
      )}

      <ConfirmDialog
        open={confirmSignOut}
        title="Sign out?"
        confirmLabel="Sign out"
        onConfirm={() => {
          setConfirmSignOut(false);
          void signOut();
        }}
        onCancel={() => setConfirmSignOut(false)}
      >
        <p>
          Your progress stays saved in your account, and comes back when you sign in again. It&apos;s removed from this
          browser, so the next person to use it can&apos;t see it.
        </p>
      </ConfirmDialog>
    </Card>
  );
}
