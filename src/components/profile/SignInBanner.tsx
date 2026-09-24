import { useEffect } from 'react';
import { useAccountStore } from '../../store/useAccountStore';

/** Google's four-colour "G", as its sign-in button guidelines ask. */
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5 flex-none">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * The home screen's invitation to sign in, for anyone who hasn't. It signs in right here
 * rather than sending people to the profile page, and starts loading Firebase as soon as it
 * shows, so the first tap opens Google's window instead of being blocked as a pop-up.
 */
export function SignInBanner() {
  const { status, user, ready, error, signIn, prepare } = useAccountStore();
  const shown = status !== 'off' && status !== 'checking' && !user;

  useEffect(() => {
    if (shown) prepare();
  }, [shown, prepare]);

  if (!shown) return null;

  return (
    <section
      aria-labelledby="sign-in-banner-title"
      className="mt-4 border-2 border-ink bg-venice-blue text-merino shadow-[6px_6px_0_var(--color-ink)] sm:mt-6"
    >
      <div className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 id="sign-in-banner-title" className="text-lg leading-tight font-bold tracking-tight uppercase sm:text-xl">
            Don&apos;t lose your progress
          </h2>
          <p className="mt-1.5 text-sm text-merino/90">
            Sign in with Google and your answers, points and practice tests are saved to your account, on every phone
            and laptop you use. Without it, they live only in this browser.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void signIn()}
          disabled={!ready}
          className="press flex min-h-12 flex-none items-center justify-center gap-3 border-2 border-ink bg-paper px-5 py-3 font-mono text-sm font-bold tracking-tight text-ink shadow-[4px_4px_0_var(--color-ink)] hover:bg-merino disabled:cursor-wait disabled:opacity-70"
        >
          <GoogleMark />
          {ready ? 'Sign in with Google' : 'Getting ready…'}
        </button>
      </div>
      {error && (
        <p className="border-t-2 border-ink bg-danger-bg px-4 py-2 text-sm font-semibold text-danger sm:px-6">{error}</p>
      )}
    </section>
  );
}
