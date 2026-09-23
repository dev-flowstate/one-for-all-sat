/**
 * The Firebase web app's settings, from Project settings → Your apps in the Firebase console.
 *
 * None of this is secret: it only names the project, and every visitor's browser receives it
 * anyway. What keeps each person's data private is the Firestore security rules, which let a
 * signed-in user read and write their own record and nothing else.
 *
 * While `apiKey` is empty, accounts are switched off and the site works as it always has.
 */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBR5twrKDrFt-u7T-US7VQYPLnTt3VlvAg',
  authDomain: 'one-for-all-sat.firebaseapp.com',
  projectId: 'one-for-all-sat',
  appId: '1:398110949450:web:25c67d060805994a7ca6b3',
};

export const cloudConfigured = FIREBASE_CONFIG.apiKey !== '';
