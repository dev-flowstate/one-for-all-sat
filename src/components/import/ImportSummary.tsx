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
      <p className="text-base font-semibold text-venice-blue-dark">
        {total} question{total === 1 ? '' : 's'} ready to import
      </p>
      <dl className="mt-3 space-y-2 text-sm text-venice-blue-dark/80">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-venice-blue-dark/60">By subject</dt>
          <dd className="mt-0.5">{SUBJECTS.map((s) => `${SUBJECT_LABELS[s]}: ${bySubject[s] ?? 0}`).join(' · ')}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-venice-blue-dark/60">By difficulty</dt>
          <dd className="mt-0.5">{DIFFICULTIES.map((d) => `${d}: ${byDifficulty[d] ?? 0}`).join(' · ')}</dd>
        </div>
      </dl>
    </div>
  );
}
