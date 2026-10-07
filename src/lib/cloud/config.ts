/**
 * Where accounts live: the Cloudflare Worker in worker/, which also serves the question bank,
 * and the Google sign-in client people sign in with (Google Cloud console → APIs & Services →
 * Credentials).
 *
 * Neither is secret: every visitor's browser receives both. What keeps each person's data
 * private is the Worker, which only hands someone their own account.
 *
 * While either is empty, accounts are switched off and the site works as it always has. A
 * local build can point at a local Worker with VITE_API_URL and VITE_GOOGLE_CLIENT_ID.
 */
export const API_URL: string = import.meta.env.VITE_API_URL || '';
export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export const cloudConfigured = API_URL !== '' && GOOGLE_CLIENT_ID !== '';
