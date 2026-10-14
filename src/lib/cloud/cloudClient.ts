/**
 * Everything that talks to the account Worker (worker/), and Google's sign-in page.
 *
 * Signing in: this tab goes to Google's sign-in page, which sends it back with an access token.
 * The Worker checks the token with Google and swaps it for a session of its own. That session is
 * kept in this browser, so later visits go straight to the Worker without Google.
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
export type CloudErrorCode = 'cancelled' | 'signed-out' | 'failed';

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

// ---- Google's sign-in page -----------------------------------------------------------------
//
// The whole tab goes to Google and comes back, rather than Google opening a window of its own:
// on iPhones that window stayed open on a blank page after signing in. Google puts the token in
// the # part of the address it sends the tab back to, which index.html moves into session
// storage before anything else reads the address. Kept in step with index.html.

/** Proves a return from Google is the sign-in this tab started. */
const STATE_KEY = 'ofa-sat:oauth-state';
/** The page to come back to, as the # part of its address. */
const BACK_KEY = 'ofa-sat:oauth-back';
/** What Google sent back. */
const RETURN_KEY = 'ofa-sat:oauth-return';

function readTab(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Reads a value kept for this tab and forgets it. */
function takeTab(key: string): string | null {
  const value = readTab(key);
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Nothing was kept.
  }
  return value;
}

/** Sends this tab to Google's sign-in page, which sends it back here signed in. */
export function startGoogleSignIn(): void {
  const state = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  try {
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(BACK_KEY, location.hash);
  } catch {
    // The return is turned away for want of the state, which says so.
  }
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: location.origin + import.meta.env.BASE_URL,
    response_type: 'token',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

/** Whether this page load is Google sending the tab back from its sign-in page. */
export function backFromGoogle(): boolean {
  return readTab(RETURN_KEY) !== null;
}

/**
 * Finishes the sign-in Google has just sent this tab back from: checks it's the one this tab
 * started, then swaps Google's token for a session. Rejects with "cancelled" when the person
 * chose not to sign in.
 */
export async function finishGoogleSignIn(): Promise<AccountUser> {
  const returned = new URLSearchParams(takeTab(RETURN_KEY) ?? '');
  const state = takeTab(STATE_KEY);
  if (!state || returned.get('state') !== state) throw new CloudError('failed');
  const accessToken = returned.get('access_token');
  if (!accessToken) throw new CloudError(returned.get('error') === 'access_denied' ? 'cancelled' : 'failed');
  const session = await api<StoredSession>('/api/session', { method: 'POST', body: JSON.stringify({ accessToken }) });
  setSession(session);
  return session.user;
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
