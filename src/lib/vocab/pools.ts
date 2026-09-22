import type { VocabCard, VocabProgressMap, VocabCardStatus } from '../../types/vocab';

/** Which deck a card currently belongs to. Cards with no record yet are unseen. */
export function vocabStatusOf(progress: VocabProgressMap, cardId: string): VocabCardStatus {
  return progress[cardId]?.status ?? 'unseen';
}

/** Words never graded — the main deck, which a card leaves the first time it's graded. */
export function getUnseenDeck(cards: VocabCard[], progress: VocabProgressMap): VocabCard[] {
  return cards.filter((c) => vocabStatusOf(progress, c.id) === 'unseen');
}

export function getWrongDeck(cards: VocabCard[], progress: VocabProgressMap): VocabCard[] {
  return cards.filter((c) => vocabStatusOf(progress, c.id) === 'wrong');
}

export function getRightDeck(cards: VocabCard[], progress: VocabProgressMap): VocabCard[] {
  return cards.filter((c) => vocabStatusOf(progress, c.id) === 'right');
}

/** Fisher-Yates on a copy — decks are shuffled so the order isn't alphabetical every time. */
export function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
