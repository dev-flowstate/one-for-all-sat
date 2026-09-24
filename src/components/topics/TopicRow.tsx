import { Link } from 'react-router-dom';
import type { SkillStat } from '../../lib/topicStats';

interface TopicRowProps {
  stat: SkillStat;
  /** Position in the weakest-to-strongest order; left out for subtopics not ranked yet. */
  rank?: number;
}

/**
 * One subtopic: how much of it you've got wrong, drawn as a bar, with a link that starts a
 * practice set on just that subtopic.
 */
export function TopicRow({ stat, rank }: TopicRowProps) {
  const wrongShare = stat.answered > 0 ? Math.round((stat.wrong / stat.answered) * 100) : 0;
  const ranked = rank !== undefined;

  return (
    <li className="flex items-center gap-3 border-t-2 border-merino-dark py-2.5 first:border-t-0">
      {ranked && (
        <span className="w-6 flex-none text-right font-mono text-sm font-bold text-ink-soft tabular-nums">{rank}</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{stat.skill}</p>
        <p className="font-mono text-[11px] text-ink-soft">{stat.domain}</p>
        {ranked ? (
          <div className="mt-1.5 flex items-center gap-2">
            <span aria-hidden="true" className="h-2 max-w-48 flex-1 border border-ink bg-paper">
              <span className="block h-full bg-danger" style={{ width: `${wrongShare}%` }} />
            </span>
            <span className="font-mono text-xs tabular-nums">
              <span className="font-bold">{wrongShare}% wrong</span>
              <span className="text-ink-soft">
                {' '}
                · {stat.wrong} of {stat.answered}
              </span>
            </span>
          </div>
        ) : (
          <p className="mt-1 font-mono text-xs text-ink-soft tabular-nums">
            {stat.answered === 0 ? 'Not started' : `${stat.answered} answered, ${stat.wrong} wrong`}
          </p>
        )}
      </div>
      <Link
        to={`/setup?skill=${encodeURIComponent(stat.skill)}`}
        aria-label={`Practise ${stat.skill}`}
        className="press flex-none border-2 border-ink bg-paper px-2.5 py-1.5 font-mono text-[11px] font-semibold tracking-tight uppercase shadow-[3px_3px_0_var(--color-ink)] hover:bg-merino-dark"
      >
        Practise
      </Link>
    </li>
  );
}
