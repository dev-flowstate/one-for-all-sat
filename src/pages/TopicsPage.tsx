import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useProgressStore } from '../store/useProgressStore';
import { MIN_ANSWERED, rankWeakest, skillStats } from '../lib/topicStats';
import { Card } from '../components/ui/Card';
import { TopicRow } from '../components/topics/TopicRow';

/** Every subtopic from weakest to strongest, and the ones without enough answers to judge. */
export function TopicsPage() {
  const { questions, progress, isLoaded } = useProgressStore();
  const stats = useMemo(() => skillStats(questions, progress), [questions, progress]);
  const ranked = rankWeakest(stats);
  const unranked = stats.filter((s) => s.answered < MIN_ANSWERED);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <Link to="/" className="mb-4 inline-block text-xs font-semibold tracking-tight text-venice-blue uppercase hover:underline">
        ← Home
      </Link>
      <h1 className="mb-2 text-2xl leading-none font-bold tracking-tight uppercase sm:text-3xl">Your topics</h1>
      <p className="mb-5 text-sm text-ink-soft">
        Weakest first: ranked by the share of answers you got wrong. A subtopic needs {MIN_ANSWERED} answers before
        it&apos;s ranked, so one unlucky miss can&apos;t put it at the bottom.
      </p>

      {!isLoaded ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <Card title="Weakest to strongest" titleRight={<span className="font-mono text-xs text-merino">[{ranked.length}]</span>}>
            {ranked.length === 0 ? (
              <p className="text-sm text-ink-soft">
                Nothing ranked yet. Answer {MIN_ANSWERED} questions in a subtopic to see where it stands.
              </p>
            ) : (
              <ol>
                {ranked.map((stat, i) => (
                  <TopicRow key={stat.skill} stat={stat} rank={i + 1} />
                ))}
              </ol>
            )}
          </Card>

          {unranked.length > 0 && (
            <Card title="Not ranked yet" titleRight={<span className="font-mono text-xs text-merino">[{unranked.length}]</span>}>
              <ul>
                {unranked.map((stat) => (
                  <TopicRow key={stat.skill} stat={stat} />
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
