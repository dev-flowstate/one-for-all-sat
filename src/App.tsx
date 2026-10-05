import { useEffect } from 'react';
import { AppRouter } from './router';
import { useProgressStore } from './store/useProgressStore';
import { useSettingsStore } from './store/useSettingsStore';
import { useVocabStore } from './store/useVocabStore';
import { useAccountStore } from './store/useAccountStore';
import { bundledQuestions } from './data/bundled-bank';
import { SatDatePrompt } from './components/sat/SatDatePrompt';
import { getWrongPool } from './lib/pools';

function App() {
  const loadAll = useProgressStore((s) => s.loadAll);
  const loadShippedBank = useProgressStore((s) => s.loadShippedBank);
  const loadProfile = useSettingsStore((s) => s.loadProfile);
  const loadVocab = useVocabStore((s) => s.load);
  const initAccount = useAccountStore((s) => s.init);

  useEffect(() => {
    // Storage has to be read before the shipped bank, since loadShippedBank skips the work
    // when a bank is already stored.
    void loadAll(bundledQuestions)
      .then(loadShippedBank)
      .then(() => {
        // The Wrong tab's questions, fetched in the background once the browser is idle, so the
        // tab opens with them ready. Nothing else is read in full until it's needed.
        const prefetch = () => {
          const { questions, progress, loadQuestions } = useProgressStore.getState();
          void loadQuestions(getWrongPool(questions, progress).map((q) => q.id));
        };
        if ('requestIdleCallback' in window) requestIdleCallback(prefetch, { timeout: 5000 });
        else setTimeout(prefetch, 2000);
      });
    loadProfile();
    loadVocab();
    initAccount();
  }, [loadAll, loadShippedBank, loadProfile, loadVocab, initAccount]);

  return (
    <>
      <AppRouter />
      <SatDatePrompt />
    </>
  );
}

export default App;
