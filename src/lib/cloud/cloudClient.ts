/**
 * Everything that talks to the account Worker (worker/), and Google's sign-in window.
 *
 * Signing in: Google's script opens its window and hands back an access token, which the
 * Worker checks with Google and swaps for a session of its own. That session is kept in this
 * browser, so later visits go straight to the Worker without Google.
 */
import type { CompletedTest } from '../../types/practiceTest';
import { getSession, setSession, type StoredSession } from '../storage/localStorage';
import type { AccountData } from './merge';
import type { DoodleRecord } from '../doodles';
import { API_URL, GOOGLE_CLIENT_ID } from './config';

export interface AccountUser {
  uid: string;
  email: string | null;
  name: string | null;
  photoUrl: string | null;
}

/** A person's public leaderboard entry: a nickname and avatar, never their email or name. */
export interface LeaderboardEntry {
  name: string;
  avatar: string;
  answered: number;
  correct: number;
  updatedAt: string;
}

/** Why signing in or saving failed, for the messages people see. */
export type CloudErrorCode = 'cancelled' | 'popup-blocked' | 'signed-out' | 'failed';

export class CloudError extends Error {
  readonly code: CloudErrorCode;
  constructor(code: CloudErrorCode) {
    super(code);
    this.code = code;
  }
}

/** The Worker takes this many finished tests per save; more go in further saves. */
const TESTS_PER_SAVE = 40;
/** Browsers only send a save started as the page closes when it's under 64 kB. */
const KEEPALIVE_LIMIT = 60_000;

async function api<T>(path: string, init: RequestInit = {}, auth = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body) headers['Content-Type'] = 'application/json';
  if (auth) {
    const session = getSession();
    if (!session) throw new CloudError('signed-out');
    headers.Authorization = `Bearer ${session.token}`;
  }
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (response.status === 401 && auth) throw new CloudError('signed-out');
  if (!response.ok) throw new CloudError('failed');
  return (response.status === 204 ? undefined : await response.json()) as T;
}

// ---- Google's sign-in window ---------------------------------------------------------------

interface TokenClient {
  requestAccessToken(): void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
            error_callback: (error: { type: string }) => void;
          }): TokenClient;
        };
      };
    };
  }
}

let googleLoading: Promise<void> | null = null;
let tokenClient: TokenClient | null = null;
/** The sign-in waiting on Google's window. */
let waiting: { resolve: (token: string) => void; reject: (error: CloudError) => void } | null = null;

function settle(token: string | null, code: CloudErrorCode = 'failed') {
  if (token) waiting?.resolve(token);
  else waiting?.reject(new CloudError(code));
  waiting = null;
}

/** Downloads Google's sign-in script, so a later tap on "Sign in" can open the window at once. */
export function loadGoogle(): Promise<void> {
  googleLoading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      tokenClient = window.google!.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        callback: (response) => settle(response.access_token ?? null, response.error === 'access_denied' ? 'cancelled' : 'failed'),
        error_callback: (error) =>
          settle(null, error.type === 'popup_failed_to_open' ? 'popup-blocked' : error.type === 'popup_closed' ? 'cancelled' : 'failed'),
      });
      resolve();
    };
    script.onerror = () => {
      // Tried again on the next call.
      googleLoading = null;
      script.remove();
      reject(new CloudError('failed'));
    };
    document.head.append(script);
  });
  return googleLoading;
}

/**
 * Opens Google's sign-in window and starts a session. Phone browsers, Safari above all, only
 * let a page open a window while the tap that asked for it is still being handled, so when
 * Google's script is already here the window opens before anything is awaited.
 */
export function signInWithGoogle(): Promise<AccountUser> {
  const accessToken = new Promise<string>((resolve, reject) => {
    const open = () => {
      waiting?.reject(new CloudError('cancelled'));
      waiting = { resolve, reject };
      tokenClient!.requestAccessToken();
    };
    if (tokenClient) open();
    else loadGoogle().then(open, reject);
  });
  return accessToken.then(async (token) => {
    const session = await api<StoredSession>('/api/session', { method: 'POST', body: JSON.stringify({ accessToken: token }) });
    setSession(session);
    return session.user;
  });
}

/** The person this browser has a session for, if any. */
export function sessionUser(): AccountUser | null {
  return getSession()?.user ?? null;
}

/** Ends the session here. Nothing on the Worker needs to change. */
export function signOut(): void {
  setSession(null);
}

// ---- The account ---------------------------------------------------------------------------

export async function readAccount(): Promise<AccountData | null> {
  const { account, history } = await api<{ account: Omit<AccountData, 'history'> | null; history: CompletedTest[] }>(
    '/api/account',
    {},
    true,
  );
  return account ? { ...account, history } : null;
}

/**
 * Saves the account in one request, writing only the tests in `testsToWrite` (finished tests
 * never change, except for their number when two devices' histories are merged) and the
 * leaderboard entry when it's given: null takes the person off the board, undefined leaves it.
 * `closing` is for a save made as the page goes away, which the browser then finishes.
 */
export async function writeAccount(
  data: AccountData,
  testsToWrite: CompletedTest[],
  leaderboard: LeaderboardEntry | null | undefined,
  closing = false,
): Promise<void> {
  const { history: _history, ...account } = data;
  for (let i = 0; i === 0 || i < testsToWrite.length; i += TESTS_PER_SAVE) {
    const tests = testsToWrite.slice(i, i + TESTS_PER_SAVE);
    const body = JSON.stringify(i === 0 ? { account, tests, leaderboard } : { tests });
    await api<void>('/api/account', { method: 'PUT', body, keepalive: closing && body.length < KEEPALIVE_LIMIT }, true);
  }
}

/** The account's doodles, deleted ones with null strokes. */
export function readDoodles(): Promise<DoodleRecord[]> {
  return api<DoodleRecord[]>('/api/doodles', {}, true);
}

/** Saves doodles, a few dozen per request; the Worker keeps whichever copy is newer. */
export async function writeDoodles(records: DoodleRecord[]): Promise<void> {
  for (let i = 0; i < records.length; i += TESTS_PER_SAVE) {
    const items = records.slice(i, i + TESTS_PER_SAVE);
    await api<void>('/api/doodles', { method: 'PUT', body: JSON.stringify({ items }) }, true);
  }
}

/** The top of the leaderboard, most questions answered first. */
export async function readLeaderboard(count: number): Promise<(LeaderboardEntry & { uid: string })[]> {
  const rows = await api<(LeaderboardEntry & { uid: string })[]>('/api/leaderboard');
  return rows.slice(0, count);
}
