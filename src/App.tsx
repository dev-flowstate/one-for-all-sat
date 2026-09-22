import { useEffect } from 'react';
import { AppRouter } from './router';
import { useProgressStore } from './store/useProgressStore';
import { useSettingsStore } from './store/useSettingsStore';
import { bundledQuestions } from './data/bundled-bank';

function App() {
  const loadAll = useProgressStore((s) => s.loadAll);
  const loadShippedBank = useProgressStore((s) => s.loadShippedBank);
  const loadProfile = useSettingsStore((s) => s.loadProfile);

  useEffect(() => {
    // Storage has to be read before the shipped bank, since loadShippedBank skips the work
    // when a bank is already stored.
    void loadAll(bundledQuestions).then(loadShippedBank);
    loadProfile();
  }, [loadAll, loadShippedBank, loadProfile]);

  return <AppRouter />;
}

export default App;
