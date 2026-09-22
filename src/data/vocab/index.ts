import type { VocabCard } from '../../types/vocab';

import { A } from './a';
import { B } from './b';
import { C } from './c';
import { D } from './d';
import { E } from './e';
import { F } from './f';
import { G } from './g';
import { H } from './h';
import { I } from './i';
import { J } from './j';
import { K } from './k';
import { L } from './l';
import { M } from './m';
import { N } from './n';
import { O } from './o';
import { P } from './p';
import { Q } from './q';
import { R } from './r';
import { S } from './s';
import { T } from './t';
import { U } from './u';
import { V } from './v';
import { W } from './w';
import { Y } from './y';
import { Z } from './z';

/**
 * The flashcard deck: the standard SAT vocabulary corpus, with definitions and example
 * sentences written for this app rather than lifted from any published word list.
 *
 * Split one file per letter purely so no single file is thousands of lines; nothing reads
 * the letters individually. There's no `x` file — no SAT-frequency word starts with one.
 */
export const VOCAB_CARDS: VocabCard[] = [
  ...A, ...B, ...C, ...D, ...E, ...F, ...G, ...H, ...I, ...J, ...K, ...L, ...M,
  ...N, ...O, ...P, ...Q, ...R, ...S, ...T, ...U, ...V, ...W, ...Y, ...Z,
];
