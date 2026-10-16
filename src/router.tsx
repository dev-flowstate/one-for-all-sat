import { lazy, Suspense, useEffect, useLayoutEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigationType } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { SiteMenu } from './components/nav/SiteMenu';
import { scrollToTop } from './lib/scrollToTop';

// Every page but home is its own file, downloaded and started only when it's opened, so the
// first screen doesn't wait for the code of a dozen others.
const SetupPage = lazy(() => import('./pages/SetupPage').then((m) => ({ default: m.SetupPage })));
const TestRunnerPage = lazy(() => import('./pages/TestRunnerPage').then((m) => ({ default: m.TestRunnerPage })));
const ResultsPage = lazy(() => import('./pages/ResultsPage').then((m) => ({ default: m.ResultsPage })));
const WrongTabPage = lazy(() => import('./pages/WrongTabPage').then((m) => ({ default: m.WrongTabPage })));
const RightTabPage = lazy(() => import('./pages/RightTabPage').then((m) => ({ default: m.RightTabPage })));
const ProfileSettingsPage = lazy(() => import('./pages/ProfileSettingsPage').then((m) => ({ default: m.ProfileSettingsPage })));
const ImportPage = lazy(() => import('./pages/ImportPage').then((m) => ({ default: m.ImportPage })));
const VocabPage = lazy(() => import('./pages/VocabPage').then((m) => ({ default: m.VocabPage })));
const VocabDrillPage = lazy(() => import('./pages/VocabDrillPage').then((m) => ({ default: m.VocabDrillPage })));
const VocabReviewPage = lazy(() => import('./pages/VocabReviewPage').then((m) => ({ default: m.VocabReviewPage })));
const PracticeTestsPage = lazy(() => import('./pages/PracticeTestsPage').then((m) => ({ default: m.PracticeTestsPage })));
const PracticeTestRunnerPage = lazy(() => import('./pages/PracticeTestRunnerPage').then((m) => ({ default: m.PracticeTestRunnerPage })));
const PracticeTestResultsPage = lazy(() => import('./pages/PracticeTestResultsPage').then((m) => ({ default: m.PracticeTestResultsPage })));
const TopicsPage = lazy(() => import('./pages/TopicsPage').then((m) => ({ default: m.TopicsPage })));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage').then((m) => ({ default: m.LeaderboardPage })));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage').then((m) => ({ default: m.ResourcesPage })));
const ReadingPage = lazy(() => import('./pages/ReadingPage').then((m) => ({ default: m.ReadingPage })));
const DoodlesPage = lazy(() => import('./pages/DoodlesPage').then((m) => ({ default: m.DoodlesPage })));
const ActivityPage = lazy(() => import('./pages/ActivityPage').then((m) => ({ default: m.ActivityPage })));

/** The pages most often opened next, fetched once the browser is idle so they open instantly:
 *  one at a time, each in its own idle moment, since starting a page's code takes a while on
 *  a phone and a tap meanwhile would have to wait for it. */
const LIKELY_NEXT = [
  () => import('./pages/SetupPage'),
  () => import('./pages/TestRunnerPage'),
  () => import('./pages/WrongTabPage'),
  () => import('./pages/VocabPage'),
];

function PrefetchLikelyPages() {
  useEffect(() => {
    let cancelled = false;
    let handle = 0;
    const idle = (fn: () => void) =>
      'requestIdleCallback' in window
        ? (handle = requestIdleCallback(fn, { timeout: 10000 }))
        : (handle = setTimeout(fn, 2000) as unknown as number);
    const next = (i: number) => {
      if (cancelled || i >= LIKELY_NEXT.length) return;
      void LIKELY_NEXT[i]().then(
        () => idle(() => next(i + 1)),
        () => {},
      );
    };
    idle(() => next(0));
    return () => {
      cancelled = true;
      if ('cancelIdleCallback' in window) cancelIdleCallback(handle);
      clearTimeout(handle);
    };
  }, []);
  return null;
}

/** A newly opened page starts at its top; going back keeps the browser's own position. */
function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  useLayoutEffect(() => {
    if (navigationType !== 'POP') scrollToTop();
  }, [pathname, navigationType]);
  return null;
}

export function AppRouter() {
  return (
    <HashRouter>
      <ScrollToTop />
      <SiteMenu />
      <PrefetchLikelyPages />
      <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/run" element={<TestRunnerPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/wrong" element={<WrongTabPage />} />
        <Route path="/right" element={<RightTabPage />} />
        <Route path="/profile" element={<ProfileSettingsPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/vocab" element={<VocabPage />} />
        <Route path="/vocab/drill" element={<VocabDrillPage />} />
        <Route path="/vocab/review" element={<VocabReviewPage />} />
        <Route path="/tests" element={<PracticeTestsPage />} />
        <Route path="/tests/:number" element={<PracticeTestResultsPage />} />
        <Route path="/test" element={<PracticeTestRunnerPage />} />
        <Route path="/topics" element={<TopicsPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/resources" element={<ResourcesPage />} />
        <Route path="/read" element={<ReadingPage />} />
        <Route path="/doodles" element={<DoodlesPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </HashRouter>
  );
}
