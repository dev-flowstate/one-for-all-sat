import { useMemo, useState } from 'react';
import type { QuestionMeta } from '../../types/question';
import type { ProgressMap } from '../../types/progress';

type When = 'all' | 'today' | '7' | '30';

const WHEN_LABELS: Record<When, string> = {
  all: 'All time',
  today: 'Today',
  '7': 'Last 7 days',
  '30': 'Last 30 days',
};

/** Since when a question's last attempt counts, as an ISO time; null for no limit. */
function cutoff(when: When): string | null {
  if (when === 'all') return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (when !== 'today') start.setDate(start.getDate() - (Number(when) - 1));
  return start.toISOString();
}

/**
 * The review tabs' filters: when a question was last attempted, and its topic. The list comes
 * back newest attempt first, so what was just practised is at the top.
 */
export function useReviewFilters<Q extends QuestionMeta>(pool: Q[], progress: ProgressMap) {
  const [when, setWhen] = useState<When>('all');
  const [topic, setTopic] = useState('all');

  const topics = useMemo(() => {
    // domain -> skill -> count, from the questions actually in the list.
    const tree = new Map<string, Map<string, number>>();
    for (const q of pool) {
      const skills = tree.get(q.domain) ?? new Map<string, number>();
      skills.set(q.skill, (skills.get(q.skill) ?? 0) + 1);
      tree.set(q.domain, skills);
    }
    return [...tree.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [pool]);

  const filtered = useMemo(() => {
    const since = cutoff(when);
    const at = (q: Q) => progress[q.id]?.lastAttemptedAt ?? '';
    return pool
      .filter((q) => !since || at(q) >= since)
      .filter((q) => topic === 'all' || (topic.startsWith('d:') ? q.domain : q.skill) === topic.slice(2))
      .sort((a, b) => at(b).localeCompare(at(a)));
  }, [pool, progress, when, topic]);

  const active = when !== 'all' || topic !== 'all';

  const controls = (
    <div className="mb-4 flex flex-wrap items-end gap-3 border-2 border-ink bg-merino-dark px-3 py-2.5">
      <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-tight uppercase">
        When
        <select
          value={when}
          onChange={(e) => setWhen(e.target.value as When)}
          className="min-h-10 border-2 border-ink bg-paper px-2 font-mono text-sm normal-case"
        >
          {(Object.keys(WHEN_LABELS) as When[]).map((w) => (
            <option key={w} value={w}>
              {WHEN_LABELS[w]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] font-semibold tracking-tight uppercase">
        Topic
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="min-h-10 w-full min-w-0 border-2 border-ink bg-paper px-2 font-mono text-sm normal-case"
        >
          <option value="all">All topics</option>
          {topics.map(([domain, skills]) => (
            <optgroup key={domain} label={domain}>
              {/* d:/s: keep a domain and a skill of the same name apart. */}
              <option value={`d:${domain}`}>
                All of {domain} ({[...skills.values()].reduce((a, b) => a + b, 0)})
              </option>
              {[...skills.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([skill, n]) => (
                  <option key={skill} value={`s:${skill}`}>
                    {skill} ({n})
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      {active && (
        <button
          type="button"
          onClick={() => {
            setWhen('all');
            setTopic('all');
          }}
          className="min-h-10 border-2 border-ink bg-paper px-3 font-mono text-xs font-bold uppercase hover:bg-merino"
        >
          Clear
        </button>
      )}
      <p className="w-full text-[11px] text-ink-soft">
        {filtered.length} of {pool.length} shown, most recently answered first
      </p>
    </div>
  );

  /** Changes only when the filters do, e.g. to start a paged list from the top again. */
  const filterKey = `${when}|${topic}`;

  return { filtered, controls, active, filterKey };
}
