import type { Question } from '../../types/question';

interface ImportSummaryProps {
  questions: Question[];
}

const SUBJECTS = ['math', 'reading-writing'] as const;
const SUBJECT_LABELS: Record<(typeof SUBJECTS)[number], string> = {
  math: 'Math',
  'reading-writing': 'Reading & Writing',
};

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;

function countBy<T, K extends string>(items: T[], keyFn: (item: T) => K): Partial<Record<K, number>> {
  const counts: Partial<Record<K, number>> = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function ImportSummary({ questions }: ImportSummaryProps) {
  const total = questions.length;
  const bySubject = countBy(questions, (q) => q.subject);
  const byDifficulty = countBy(questions, (q) => q.difficulty);

  return (
    <div>
      <div className="flex items-baseline gap-3 border-b-2 border-ink pb-3">
        <span className="text-4xl leading-none font-bold tabular-nums">{total}</span>
        <span className="text-xs font-semibold tracking-tight text-ink-soft uppercase">
          question{total === 1 ? '' : 's'} ready
        </span>
      </div>
      {/* 2px gaps over ink draw the rules, so the cells stay aligned however they wrap. */}
      <dl className="mt-3 grid grid-cols-2 gap-[2px] border-2 border-ink bg-ink sm:grid-cols-3">
        {SUBJECTS.map((s) => (
          <div key={s} className="bg-merino-dark px-3 py-2">
            <dt className="text-[10px] font-semibold tracking-tight text-ink-soft uppercase">{SUBJECT_LABELS[s]}</dt>
            <dd className="text-lg font-bold tabular-nums">{bySubject[s] ?? 0}</dd>
          </div>
        ))}
        {DIFFICULTIES.map((d) => (
          <div key={d} className="bg-merino-dark px-3 py-2">
            <dt className="text-[10px] font-semibold tracking-tight text-ink-soft uppercase">{d}</dt>
            <dd className="text-lg font-bold tabular-nums">{byDifficulty[d] ?? 0}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
