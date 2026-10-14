/**
 * The site's backend on Cloudflare: Google sign-in, each person's saved progress, and the
 * public leaderboard, kept in a D1 database. The site itself stays on GitHub Pages and calls
 * this from there; its question bank is downloaded from here too, as a plain file (see
 * wrangler.jsonc), which never reaches this code.
 *
 *   POST /api/session      a Google access token in, a session for this site out
 *   GET  /api/account      the signed-in person's saved data
 *   PUT  /api/account      saves it, finished tests and their leaderboard entry included
 *   GET  /api/leaderboard  the top 100, for anyone
 *   GET  /api/doodles      the signed-in person's doodles, deleted ones as null
 *   PUT  /api/doodles      saves some, each only if newer than the copy already saved
 */

interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  SESSION_SECRET: string;
  /** Set only in .dev.vars: lets local tests sign in without Google. */
  DEV_LOGIN?: string;
}

const SITE_ORIGIN = 'https://dev-flowstate.github.io';
const SESSION_DAYS = 365;
/** D1 refuses a value over 2 MB. */
const MAX_VALUE_BYTES = 1_900_000;
const MAX_BODY_BYTES = 8_000_000;
/** D1 runs at most 50 queries per request on the free plan; a save is one per test plus two. */
const MAX_TESTS_PER_SAVE = 40;
const LEADERBOARD_SIZE = 100;
/** How long a read of the leaderboard is reused, so a busy page doesn't read it every view. */
const LEADERBOARD_REUSE_MS = 30_000;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = corsHeaders(request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    try {
      const response = await route(request, env);
      for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
      return response;
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) console.error(error);
      return Response.json({ error: error instanceof HttpError ? error.message : 'Something went wrong' }, { status, headers });
    }
  },
} satisfies ExportedHandler<Env>;

async function route(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);
  const method = request.method;
  if (pathname === '/api/session' && method === 'POST') return startSession(request, env);
  if (pathname === '/api/account' && method === 'GET') return readAccount(request, env);
  if (pathname === '/api/account' && method === 'PUT') return writeAccount(request, env);
  if (pathname === '/api/leaderboard' && method === 'GET') return readLeaderboard(env);
  if (pathname === '/api/doodles' && method === 'GET') return readDoodles(request, env);
  if (pathname === '/api/doodles' && method === 'PUT') return writeDoodles(request, env);
  throw new HttpError(404, 'Not found');
}

/** The site, and the dev server on this machine while testing. */
function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '';
  if (origin !== SITE_ORIGIN && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    // Browsers otherwise ask before every save, and each asking counts as a request.
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

// ---- Sessions ------------------------------------------------------------------------------
// A session is the person's id and an expiry, signed with SESSION_SECRET, which only this
// Worker holds. Nothing is stored for it, so checking one costs no database read.

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function signingKey(env: Env): Promise<CryptoKey> {
  if (!env.SESSION_SECRET) throw new Error('SESSION_SECRET is not set');
  return crypto.subtle.importKey('raw', encoder.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

async function issueSession(env: Env, uid: string): Promise<string> {
  const body = toBase64Url(encoder.encode(JSON.stringify({ uid, exp: Date.now() + SESSION_DAYS * 86_400_000 })));
  const signature = await crypto.subtle.sign('HMAC', await signingKey(env), encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

/** The signed-in person's id, or a 401 for a missing, altered or expired session. */
async function requireUser(request: Request, env: Env): Promise<string> {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
  const [body, signature] = token.split('.');
  if (body && signature) {
    try {
      const valid = await crypto.subtle.verify('HMAC', await signingKey(env), fromBase64Url(signature), encoder.encode(body));
      const { uid, exp } = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as { uid?: unknown; exp?: unknown };
      if (valid && typeof uid === 'string' && typeof exp === 'number' && exp > Date.now()) return uid;
    } catch {
      // Not a session this Worker made.
    }
  }
  throw new HttpError(401, 'Signed out');
}

// ---- Sign-in -------------------------------------------------------------------------------

interface GoogleUser {
  sub: string;
  /** Only when Google has verified it. */
  email: string | null;
  name: string | null;
  picture: string | null;
}

/** Who a Google access token belongs to, if it was issued to this site's sign-in client. A
 *  token another app obtained is refused, so it can't be used to sign in as its owner here. */
async function googleUser(env: Env, accessToken: string): Promise<GoogleUser> {
  const info = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
  const token = info.ok ? ((await info.json()) as { aud?: string; sub?: string; email?: string; email_verified?: string }) : null;
  if (!token?.sub || !env.GOOGLE_CLIENT_ID || token.aud !== env.GOOGLE_CLIENT_ID) throw new HttpError(401, 'Google sign-in failed');

  const profile = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const details = profile.ok ? ((await profile.json()) as { name?: string; picture?: string }) : {};
  return {
    sub: token.sub,
    email: token.email && token.email_verified === 'true' ? token.email.toLowerCase() : null,
    name: details.name ?? null,
    picture: details.picture ?? null,
  };
}

async function startSession(request: Request, env: Env): Promise<Response> {
  const body = (await readJson(request)) as { accessToken?: unknown; dev?: GoogleUser };
  const google =
    env.DEV_LOGIN === '1' && body.dev
      ? body.dev
      : typeof body.accessToken === 'string'
        ? await googleUser(env, body.accessToken)
        : null;
  if (!google) throw new HttpError(400, 'No Google token');

  let user = await env.DB.prepare('SELECT id FROM users WHERE google_sub = ?').bind(google.sub).first<{ id: string }>();
  // An account copied from Firebase without its Google id is claimed once, by its verified email.
  if (!user && google.email) {
    user = await env.DB.prepare('UPDATE users SET google_sub = ? WHERE google_sub IS NULL AND email = ? RETURNING id')
      .bind(google.sub, google.email)
      .first<{ id: string }>();
  }
  if (!user) {
    user = { id: crypto.randomUUID() };
    await env.DB.prepare('INSERT INTO users (id, google_sub, email) VALUES (?, ?, ?)').bind(user.id, google.sub, google.email).run();
  }

  return Response.json({
    token: await issueSession(env, user.id),
    user: { uid: user.id, email: google.email, name: google.name, photoUrl: google.picture },
  });
}

// ---- The account ---------------------------------------------------------------------------

async function readAccount(request: Request, env: Env): Promise<Response> {
  const uid = await requireUser(request, env);
  const user = await env.DB.prepare('SELECT data FROM users WHERE id = ?').bind(uid).first<{ data: string | null }>();
  if (!user) throw new HttpError(401, 'Signed out');
  if (!user.data) return Response.json({ account: null, history: [] });
  const tests = await env.DB.prepare('SELECT data FROM tests WHERE user_id = ?').bind(uid).all<{ data: string }>();
  // Put together as text: the stored JSON is sent as it is, without being read and rewritten.
  const history = tests.results.map((t) => t.data).join(',');
  return new Response(`{"account":${user.data},"history":[${history}]}`, {
    headers: { 'Content-Type': 'application/json' },
  });
}

interface LeaderboardEntry {
  name: string;
  avatar: string;
  answered: number;
  correct: number;
}

/** The same checks the Firestore rules made: only these fields, in sensible ranges. */
function validEntry(value: unknown): value is LeaderboardEntry {
  if (!isObject(value)) return false;
  const { name, avatar, answered, correct, ...rest } = value;
  return (
    Object.keys(rest).every((key) => key === 'updatedAt') &&
    typeof name === 'string' &&
    name.trim().length > 0 &&
    name.length <= 40 &&
    typeof avatar === 'string' &&
    avatar.length <= 16 &&
    Number.isInteger(answered) &&
    (answered as number) >= 0 &&
    (answered as number) <= 100_000 &&
    Number.isInteger(correct) &&
    (correct as number) >= 0 &&
    (correct as number) <= (answered as number)
  );
}

/**
 * One save: the account (everything but finished tests), any finished tests not saved before,
 * and the leaderboard entry when it changed (null takes the person off the board). All of it
 * is written together or not at all.
 */
async function writeAccount(request: Request, env: Env): Promise<Response> {
  const uid = await requireUser(request, env);
  const body = (await readJson(request)) as { account?: unknown; tests?: unknown; leaderboard?: unknown };
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];

  if (body.account !== undefined) {
    if (!isObject(body.account)) throw new HttpError(400, 'Bad account');
    const data = sized(JSON.stringify(body.account));
    statements.push(env.DB.prepare('UPDATE users SET data = ?, updated_at = ? WHERE id = ?').bind(data, now, uid));
  }

  const tests = body.tests ?? [];
  if (!Array.isArray(tests) || tests.length > MAX_TESTS_PER_SAVE) throw new HttpError(400, 'Bad tests');
  for (const test of tests) {
    if (!isObject(test) || typeof test.completedAt !== 'string' || test.completedAt.length > 64) {
      throw new HttpError(400, 'Bad test');
    }
    statements.push(
      env.DB.prepare(
        'INSERT INTO tests (user_id, completed_at, data) VALUES (?, ?, ?) ON CONFLICT (user_id, completed_at) DO UPDATE SET data = excluded.data',
      ).bind(uid, test.completedAt, sized(JSON.stringify(test))),
    );
  }

  if (body.leaderboard === null) {
    statements.push(env.DB.prepare('DELETE FROM leaderboard WHERE user_id = ?').bind(uid));
  } else if (validEntry(body.leaderboard)) {
    // An entry that fails the checks is left out rather than refusing the save: the
    // leaderboard must never stop someone's progress from being saved.
    const { name, avatar, answered, correct } = body.leaderboard;
    statements.push(
      env.DB.prepare(
        `INSERT INTO leaderboard (user_id, name, avatar, answered, correct, updated_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar,
           answered = excluded.answered, correct = excluded.correct, updated_at = excluded.updated_at`,
      ).bind(uid, name.trim(), avatar, answered, correct, now),
    );
  }

  if (statements.length > 0) await env.DB.batch(statements);
  return new Response(null, { status: 204 });
}

// ---- Doodles ---------------------------------------------------------------------------------

async function readDoodles(request: Request, env: Env): Promise<Response> {
  const uid = await requireUser(request, env);
  const { results } = await env.DB.prepare('SELECT id, strokes, saved_at FROM doodles WHERE user_id = ?')
    .bind(uid)
    .all<{ id: string; strokes: string | null; saved_at: string }>();
  // Put together as text, like the account: stored strokes are sent as they are.
  const items = results.map((r) => `{"id":${JSON.stringify(r.id)},"savedAt":${JSON.stringify(r.saved_at)},"strokes":${r.strokes ?? 'null'}}`);
  return new Response(`[${items.join(',')}]`, { headers: { 'Content-Type': 'application/json' } });
}

/** Each doodle is written only when it's newer than the saved copy, so an older device can't
 *  undo a newer drawing, or bring back one deleted elsewhere. */
async function writeDoodles(request: Request, env: Env): Promise<Response> {
  const uid = await requireUser(request, env);
  const { items } = (await readJson(request)) as { items?: unknown };
  if (!Array.isArray(items) || items.length > MAX_TESTS_PER_SAVE) throw new HttpError(400, 'Bad doodles');
  const statements = items.map((item) => {
    if (
      !isObject(item) ||
      typeof item.id !== 'string' ||
      item.id.length > 200 ||
      typeof item.savedAt !== 'string' ||
      item.savedAt.length > 64 ||
      !(item.strokes === null || Array.isArray(item.strokes))
    ) {
      throw new HttpError(400, 'Bad doodle');
    }
    return env.DB.prepare(
      `INSERT INTO doodles (user_id, id, strokes, saved_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, id) DO UPDATE SET strokes = excluded.strokes, saved_at = excluded.saved_at
       WHERE excluded.saved_at > doodles.saved_at`,
    ).bind(uid, item.id, item.strokes === null ? null : sized(JSON.stringify(item.strokes)), item.savedAt);
  });
  if (statements.length > 0) await env.DB.batch(statements);
  return new Response(null, { status: 204 });
}

// ---- The leaderboard -----------------------------------------------------------------------

/** The last read, reused for a little while by whichever requests reach this same instance. */
let leaderboardCache: { at: number; body: string } | null = null;

async function readLeaderboard(env: Env): Promise<Response> {
  if (!leaderboardCache || Date.now() - leaderboardCache.at > LEADERBOARD_REUSE_MS) {
    const { results } = await env.DB.prepare(
      `SELECT user_id AS uid, name, avatar, answered, correct, updated_at AS updatedAt
       FROM leaderboard ORDER BY answered DESC, correct DESC LIMIT ?`,
    )
      .bind(LEADERBOARD_SIZE)
      .all();
    leaderboardCache = { at: Date.now(), body: JSON.stringify(results) };
  }
  return new Response(leaderboardCache.body, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' },
  });
}

// ---- Helpers -------------------------------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) throw new HttpError(413, 'Too large');
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, 'Too large');
  try {
    const value: unknown = JSON.parse(text);
    if (isObject(value)) return value;
  } catch {
    // Falls through to the 400.
  }
  throw new HttpError(400, 'Expected a JSON object');
}

/** A value small enough for one D1 cell. */
function sized(json: string): string {
  if (encoder.encode(json).length > MAX_VALUE_BYTES) throw new HttpError(413, 'Too large to save');
  return json;
}
