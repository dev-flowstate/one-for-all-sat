/** How many words the vocabulary deck has. Kept apart from the deck itself, which is ~215kB
 *  and only loaded on the vocabulary screens, so the home screen's study calendar can count
 *  the words left without downloading it. src/data/vocab/index.ts checks it in development. */
export const VOCAB_CARD_COUNT = 991;
