import { useEffect } from 'react';
import { AppRouter } from './router';
import { useProgressStore } from './store/useProgressStore';
import { useSettingsStore } from './store/useSettingsStore';
import { bundledQuestions } from './data/bundled-bank';

function App() {
  const loadAll = useProgressStore((s) => s.loadAll);
  const loadProfile = useSettingsStore((s) => s.loadProfile);

  useEffect(() => {
    loadAll(bundledQuestions);
    loadProfile();
  }, [loadAll, loadProfile]);

  return <AppRouter />;
}

export default App;
