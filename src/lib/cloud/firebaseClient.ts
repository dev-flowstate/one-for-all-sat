/**
 * Everything that touches Firebase. Only ever loaded with a dynamic import, so the SDK is a
 * separate download that people who never sign in don't pay for.
 *
 * Uses Firestore Lite: plain reads and writes with no live listeners or offline cache, which
 * is all a per-person save needs, at a fraction of the full SDK's size.
 */
import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  writeBatch,
} from 'firebase/firestore/lite';
import type { CompletedTest } from '../../types/practiceTest';
import type { AccountData } from './merge';
import { FIREBASE_CONFIG } from './config';

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

// Local Firebase emulators, for testing sign-in and saving without a real project. Only a
// build made with this variable set talks to them; the published site never does.
if (import.meta.env.VITE_FIREBASE_EMULATORS) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8181);
}

export interface AccountUser {
  uid: string;
  email: string | null;
  name: string | null;
  photoUrl: string | null;
}

function toAccountUser(user: User): AccountUser {
  return { uid: user.uid, email: user.email, name: user.displayName, photoUrl: user.photoURL };
}

/** Calls back with the signed-in user, or null, now and whenever it changes. */
export function watchUser(callback: (user: AccountUser | null) => void): () => void {
  return onAuthStateChanged(auth, (user) => callback(user && toAccountUser(user)));
}

export async function signInWithGoogle(): Promise<AccountUser> {
  const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
  return toAccountUser(user);
}

export function signOut(): Promise<void> {
  return firebaseSignOut(auth);
}

/**
 * One document per person, users/{uid}, with finished tests in their own collection under it:
 * each test keeps all 98 answers, and a long history would outgrow Firestore's 1 MB document
 * limit if it lived in the same document.
 */
type StoredAccount = Omit<AccountData, 'history'>;

export async function readAccount(uid: string): Promise<AccountData | null> {
  const [account, tests] = await Promise.all([
    getDoc(doc(db, 'users', uid)),
    getDocs(collection(db, 'users', uid, 'tests')),
  ]);
  if (!account.exists()) return null;
  return {
    ...(account.data() as StoredAccount),
    history: tests.docs.map((d) => d.data() as CompletedTest),
  };
}

/** Saves the account, writing only the tests in `testsToWrite`: finished tests never change,
 *  except for their number when two devices' histories are merged. */
export async function writeAccount(uid: string, data: AccountData, testsToWrite: CompletedTest[]): Promise<void> {
  const { history: _history, ...account } = data;
  // Firestore refuses `undefined` fields, which optional properties leave all over the data.
  const clean = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid), { ...clean(account), updatedAt: new Date().toISOString() });
  for (const test of testsToWrite) batch.set(doc(db, 'users', uid, 'tests', test.completedAt), clean(test));
  await batch.commit();
}

