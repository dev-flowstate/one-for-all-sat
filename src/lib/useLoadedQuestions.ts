import { useEffect, useState } from 'react';
import type { Question } from '../types/question';
import { useProgressStore } from '../store/useProgressStore';

/**
 * Loads the full questions with these ids from storage, for a screen about to show them.
 * `ready` once they're in, or once storage has answered for any that aren't stored at all.
 */
export function useLoadedQuestions(ids: string[]): { loaded: Record<string, Question>; ready: boolean } {
  const loaded = useProgressStore((s) => s.loaded);
  const isLoaded = useProgressStore((s) => s.isLoaded);
  const key = ids.join('\n');
  const [answered, setAnswered] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    let live = true;
    void useProgressStore
      .getState()
      .loadQuestions(key ? key.split('\n') : [])
      .then(() => live && setAnswered(key));
    return () => {
      live = false;
    };
  }, [key, isLoaded]);

  return { loaded, ready: answered === key || ids.every((id) => loaded[id]) };
}
