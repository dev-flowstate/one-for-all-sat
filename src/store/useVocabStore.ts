import { create } from 'zustand';
import type { VocabCard, VocabProgressMap } from '../types/vocab';
import { getVocabProgress, setVocabProgress } from '../lib/storage/localStorage';
import { getUnseenDeck, getWrongDeck, getRightDeck, shuffle } from '../lib/vocab/pools';

export type VocabDeckSource = 'unseen' | 'wrong' | 'right' | 'all';
export type VocabOutcome = 'right' | 'wrong';

interface VocabStore {
  /** Empty until `ensureCards()` resolves — see the note on that action. */
  cards: VocabCard[];
  cardsLoaded: boolean;
  progress: VocabProgressMap;
  isLoaded: boolean;

  /** Remaining card ids for this session; the card on screen is always `deck[0]`. */
  deck: string[];
  isFlipped: boolean;
  /** Distinct cards the session started with — the denominator for the progress bar. */
  sessionSize: number;
  /** Latest grade per card this session. A card missed then recovered counts once, as right. */
  sessionOutcomes: Record<string, VocabOutcome>;
  /** Cards already sent to the back once. Without this, a card you keep missing never leaves. */
  requeued: string[];

  /** Reads saved progress. Cheap (localStorage only), so it runs at startup. */
  load: () => void;
  /** Pulls in the deck itself. Called by the vocabulary screens rather than at startup:
   *  991 cards are ~215kB of JS, and someone who only drills questions should never pay
   *  to download them. The dynamic import is what splits them into their own chunk. */
  ensureCards: () => Promise<void>;
  startSession: (source: VocabDeckSource, size: number) => void;
  flip: () => void;
  grade: (outcome: VocabOutcome) => void;
  endSession: () => void;
  /** Pass 'all' or a list of card ids to send them back to the unseen deck. */
  resetVocab: (cardIds: string[] | 'all') => void;
}

function deckFor(source: VocabDeckSource, cards: VocabCard[], progress: VocabProgressMap): VocabCard[] {
  switch (source) {
    case 'unseen':
      return getUnseenDeck(cards, progress);
    case 'wrong':
      return getWrongDeck(cards, progress);
    case 'right':
      return getRightDeck(cards, progress);
    case 'all':
      return cards;
  }
}

export const useVocabStore = create<VocabStore>((set, get) => ({
  cards: [],
  cardsLoaded: false,
  progress: {},
  isLoaded: false,

  deck: [],
  isFlipped: false,
  sessionSize: 0,
  sessionOutcomes: {},
  requeued: [],

  load: () => {
    set({ progress: getVocabProgress(), isLoaded: true });
  },

  ensureCards: async () => {
    if (get().cardsLoaded) return;
    const { VOCAB_CARDS } = await import('../data/vocab');
    set({ cards: VOCAB_CARDS, cardsLoaded: true });
  },

  startSession: (source, size) => {
    const { cards, progress } = get();
    const picked = shuffle(deckFor(source, cards, progress)).slice(0, size);
    set({
      deck: picked.map((c) => c.id),
      sessionSize: picked.length,
      sessionOutcomes: {},
      requeued: [],
      isFlipped: false,
    });
  },

  flip: () => set((s) => ({ isFlipped: !s.isFlipped })),

  grade: (outcome) => {
    const { deck, progress, requeued, sessionOutcomes } = get();
    const cardId = deck[0];
    if (!cardId) return;

    // A card missed earlier in this session stays filed under Wrong even if the second look
    // goes well — recalling a word only after failing it once isn't knowing it. Across
    // sessions the newest grade still wins, so drilling the Wrong deck can promote a word.
    const filed: VocabOutcome = sessionOutcomes[cardId] === 'wrong' ? 'wrong' : outcome;

    const prev = progress[cardId];
    const nextProgress: VocabProgressMap = {
      ...progress,
      [cardId]: {
        status: filed,
        reviews: (prev?.reviews ?? 0) + 1,
        lastReviewedAt: new Date().toISOString(),
      },
    };
    setVocabProgress(nextProgress);

    // Right retires the card. Wrong sends it to the back so it comes round once more —
    // but only once, otherwise a word you can't recall would loop forever.
    const rest = deck.slice(1);
    const sendToBack = outcome === 'wrong' && !requeued.includes(cardId);

    set({
      progress: nextProgress,
      deck: sendToBack ? [...rest, cardId] : rest,
      requeued: sendToBack ? [...requeued, cardId] : requeued,
      sessionOutcomes: { ...sessionOutcomes, [cardId]: filed },
      isFlipped: false,
    });
  },

  endSession: () => set({ deck: [], sessionSize: 0, sessionOutcomes: {}, requeued: [], isFlipped: false }),

  resetVocab: (cardIds) => {
    const progress = { ...get().progress };
    if (cardIds === 'all') {
      for (const key of Object.keys(progress)) delete progress[key];
    } else {
      for (const id of cardIds) delete progress[id];
    }
    setVocabProgress(progress);
    set({ progress });
  },
}));
