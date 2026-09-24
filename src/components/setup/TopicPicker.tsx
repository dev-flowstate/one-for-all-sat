import { useEffect, useRef, type ReactNode } from 'react';
import type { Subject } from '../../types/question';
import { DOMAINS } from '../../data/taxonomy';
import { accuracyTone, isWeak, type SkillStat } from '../../lib/topicStats';

interface TopicPickerProps {
  /** Selected subtopics. None selected means everything. */
  selected: string[];
  onChange: (skills: string[]) => void;
  stats: SkillStat[];
}

const SUBJECTS: { id: Subject; label: string }[] = [
  { id: 'math', label: 'Math' },
  { id: 'reading-writing', label: 'Reading & Writing' },
];

/**
 * Domains with their subtopics, each showing how far through it you are and how often you've
 * been right. Ticking a domain ticks all of its subtopics; ticking some gives a partial mark.
 */
export function TopicPicker({ selected, onChange, stats }: TopicPickerProps) {
  const statFor = (skill: string) => stats.find((s) => s.skill === skill);

  function toggle(skills: string[], on: boolean) {
    const rest = selected.filter((s) => !skills.includes(s));
    onChange(on ? [...rest, ...skills] : rest);
  }

  return (
    <div className="flex flex-col gap-6">
      {SUBJECTS.map((subject) => (
        <div key={subject.id}>
          <h3 className="mb-2 font-mono text-xs font-bold tracking-tight text-venice-blue-dark uppercase">
            {subject.label}
          </h3>
          <div className="flex flex-col gap-4">
            {DOMAINS.filter((d) => d.subject === subject.id).map((domain) => {
              const picked = domain.skills.filter((s) => selected.includes(s)).length;
              return (
                <div key={domain.id} className="border-t-2 border-merino-dark pt-2">
                  <Tick
                    id={`domain-${domain.id}`}
                    checked={picked === domain.skills.length}
                    partial={picked > 0 && picked < domain.skills.length}
                    onChange={(on) => toggle(domain.skills, on)}
                  >
                    <span className="font-semibold">{domain.name}</span>
                  </Tick>
                  <ul className="mt-1 flex flex-col">
                    {domain.skills.map((skill) => {
                      const stat = statFor(skill);
                      return (
                        <li
                          key={skill}
                          className="grid grid-cols-[1fr_auto] items-center gap-x-3 pl-7 sm:grid-cols-[1fr_9rem_4.5rem]"
                        >
                          <Tick
                            id={`skill-${domain.id}-${skill}`}
                            checked={selected.includes(skill)}
                            onChange={(on) => toggle([skill], on)}
                          >
                            <span>{skill}</span>
                            {stat && isWeak(stat) && (
                              <span className="ml-2 inline-block border-2 border-danger bg-danger-bg px-1.5 font-mono text-[10px] font-bold tracking-tight text-danger uppercase">
                                Weak
                              </span>
                            )}
                          </Tick>
                          {stat && <SkillProgress stat={stat} />}
                          {stat && <SkillAccuracy stat={stat} />}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Done out of the total, as a bar and a count. On a phone it drops under the name. */
function SkillProgress({ stat }: { stat: SkillStat }) {
  const share = stat.total > 0 ? (stat.answered / stat.total) * 100 : 0;
  return (
    <div className="col-start-1 row-start-2 -mt-1 mb-2 flex items-center gap-2 pl-7 sm:col-start-auto sm:row-start-auto sm:m-0 sm:pl-0">
      <span aria-hidden="true" className="h-2 w-16 flex-none border border-ink bg-paper sm:flex-1">
        <span className="block h-full bg-venice-blue" style={{ width: `${share}%` }} />
      </span>
      <span className="font-mono text-xs text-ink-soft tabular-nums sm:w-16 sm:flex-none">
        {stat.answered}/{stat.total}
        <span className="sr-only"> done</span>
      </span>
    </div>
  );
}

function SkillAccuracy({ stat }: { stat: SkillStat }) {
  if (stat.accuracy === null) {
    return (
      <span className="text-right font-mono text-xs text-ink-soft" aria-label="Nothing answered yet">
        –
      </span>
    );
  }
  return (
    <span className="flex items-center justify-end gap-1.5 font-mono text-xs font-semibold tabular-nums">
      <span aria-hidden="true" className={`block h-2 w-2 flex-none rounded-full ${accuracyTone(stat.accuracy)}`} />
      {stat.accuracy}%<span className="sr-only"> right</span>
    </span>
  );
}

interface TickProps {
  id: string;
  checked: boolean;
  /** Some but not all of a domain's subtopics are ticked. */
  partial?: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}

/** The app's drawn checkbox, with a "partly ticked" state for domains. */
function Tick({ id, checked, partial = false, onChange, children }: TickProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = partial;
  }, [partial]);

  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-2.5 font-mono text-sm select-none">
      <input
        ref={ref}
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 flex-none items-center justify-center border-2 border-ink peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-coral ${
          checked || partial ? 'bg-venice-blue' : 'bg-paper'
        }`}
      >
        <span className={`text-[13px] leading-none font-bold text-merino ${checked || partial ? '' : 'invisible'}`}>
          {partial ? '–' : '×'}
        </span>
      </span>
      <span className="min-w-0">{children}</span>
    </label>
  );
}
