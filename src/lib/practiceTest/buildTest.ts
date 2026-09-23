import type { Difficulty, Question, Subject } from '../../types/question';
import type { ProgressMap } from '../../types/progress';
import type { TestModule } from '../../types/practiceTest';
import { statusOf } from '../pools';
import { shuffle } from '../vocab/pools';

interface SectionPlan {
  subject: Subject;
  title: string;
  minutes: number;
  /** Questions per domain in each of the two modules, in the order they appear. */
  modules: [Record<string, number>, Record<string, number>];
}

/**
 * The digital SAT's shape: 54 Reading and Writing questions in two 32-minute modules, then 44
 * Math questions in two 35-minute modules. Each module's domain counts follow College Board's
 * shares (Information and Ideas 26%, Craft and Structure 28%, and so on). Reading and Writing
 * keeps the test's own domain order: Craft and Structure first, Expression of Ideas last.
 */
export const SECTIONS: SectionPlan[] = [
  {
    subject: 'reading-writing',
    title: 'Reading and Writing',
    minutes: 32,
    modules: [
      {
        'Craft and Structure': 8,
        'Information and Ideas': 7,
        'Standard English Conventions': 7,
        'Expression of Ideas': 5,
      },
      {
        'Craft and Structure': 7,
        'Information and Ideas': 7,
        'Standard English Conventions': 7,
        'Expression of Ideas': 6,
      },
    ],
  },
  {
    subject: 'math',
    title: 'Math',
    minutes: 35,
    modules: [
      { Algebra: 8, 'Advanced Math': 7, 'Problem-Solving and Data Analysis': 4, 'Geometry and Trigonometry': 3 },
      { Algebra: 7, 'Advanced Math': 8, 'Problem-Solving and Data Analysis': 3, 'Geometry and Trigonometry': 4 },
    ],
  },
];

export const BREAK_MINUTES = 10;

/** Module 1 is easy and medium questions; module 2 is medium and hard. */
const MODULE_DIFFICULTIES: [Difficulty, Difficulty][] = [
  ['Easy', 'Medium'],
  ['Medium', 'Hard'],
];

const DIFFICULTY_RANK: Record<Difficulty, number> = { Easy: 0, Medium: 1, Hard: 2 };

/** Questions in a section, both modules together. */
export function sectionSize(section: SectionPlan): number {
  return section.modules.reduce((sum, counts) => sum + Object.values(counts).reduce((a, b) => a + b, 0), 0);
}

export function sectionTitle(subject: Subject): string {
  return SECTIONS.find((s) => s.subject === subject)?.title ?? subject;
}

export interface BuiltTest {
  modules: TestModule[];
  /** How many questions the test is missing. */
  shortBy: number;
}

/**
 * Draws a full test from the bank. Only unattempted questions are used unless `allowOld` is
 * set, in which case questions already answered fill whatever the unattempted ones can't.
 */
export function buildTest(questions: Question[], progress: ProgressMap, allowOld: boolean): BuiltTest {
  const used = new Set<string>();
  const fresh = shuffle(questions.filter((q) => statusOf(progress, q.id) === 'unattempted'));
  const old = allowOld ? shuffle(questions.filter((q) => statusOf(progress, q.id) !== 'unattempted')) : [];

  function take(subject: Subject, domain: string, difficulties: Difficulty[], count: number): Question[] {
    const picked: Question[] = [];
    for (const source of [fresh, old]) {
      for (const q of source) {
        if (picked.length === count) return picked;
        if (used.has(q.id) || q.subject !== subject || q.domain !== domain) continue;
        if (!difficulties.includes(q.difficulty)) continue;
        used.add(q.id);
        picked.push(q);
      }
    }
    return picked;
  }

  const modules: TestModule[] = [];
  let shortBy = 0;
  for (const section of SECTIONS) {
    section.modules.forEach((counts, m) => {
      const [lower, upper] = MODULE_DIFFICULTIES[m];
      let picked: Question[] = [];
      for (const [domain, count] of Object.entries(counts)) {
        // An even split between the module's two difficulties, topped up from either one
        // when a difficulty runs short.
        const inDomain = [
          ...take(section.subject, domain, [lower], Math.ceil(count / 2)),
          ...take(section.subject, domain, [upper], Math.floor(count / 2)),
        ];
        inDomain.push(...take(section.subject, domain, [lower, upper], count - inDomain.length));
        shortBy += count - inDomain.length;
        picked.push(...inDomain.sort((a, b) => DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty]));
      }
      // Math mixes its domains and gets harder as the module goes on.
      if (section.subject === 'math') {
        picked = shuffle(picked).sort((a, b) => DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty]);
      }
      modules.push({
        subject: section.subject,
        number: (m + 1) as 1 | 2,
        minutes: section.minutes,
        questionIds: picked.map((q) => q.id),
      });
    });
  }
  return { modules, shortBy };
}
