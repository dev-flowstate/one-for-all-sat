import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { SetupPage } from './pages/SetupPage';
import { TestRunnerPage } from './pages/TestRunnerPage';
import { ResultsPage } from './pages/ResultsPage';
import { WrongTabPage } from './pages/WrongTabPage';
import { RightTabPage } from './pages/RightTabPage';
import { ProfileSettingsPage } from './pages/ProfileSettingsPage';
import { ImportPage } from './pages/ImportPage';

export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/run" element={<TestRunnerPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/wrong" element={<WrongTabPage />} />
        <Route path="/right" element={<RightTabPage />} />
        <Route path="/profile" element={<ProfileSettingsPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
