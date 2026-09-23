import type { TestResponse } from '../../types/practiceTest';

interface QuestionGridProps {
  questionIds: string[];
  responses: Record<string, TestResponse>;
  marked: string[];
  /** Outlined as "you are here"; left out on the review page. */
  currentIndex?: number;
  onSelect: (index: number) => void;
}

/**
 * Every question in the module as a numbered box: filled when answered, dashed when blank, and
 * flagged when marked for review. Used by the question navigator and the review page.
 */
export function QuestionGrid({ questionIds, responses, marked, currentIndex, onSelect }: QuestionGridProps) {
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] font-semibold tracking-tight text-ink-soft uppercase">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="block h-3 w-3 border-2 border-ink bg-venice-blue" />
          Answered
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="block h-3 w-3 border-2 border-dashed border-ink bg-paper" />
          Unanswered
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="text-coral">
            ⚑
          </span>
          For review
        </li>
      </ul>

      <ol className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-2">
        {questionIds.map((id, index) => {
          const answered = !!(responses[id]?.choice || responses[id]?.text);
          const flagged = marked.includes(id);
          const current = index === currentIndex;
          const state = [answered ? 'answered' : 'unanswered', flagged && 'marked for review', current && 'current']
            .filter(Boolean)
            .join(', ');
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-label={`Question ${index + 1}, ${state}`}
                aria-current={current ? 'step' : undefined}
                className={`relative flex h-11 w-full items-center justify-center border-2 border-ink font-mono text-sm font-bold tabular-nums ${
                  answered ? 'bg-venice-blue text-merino' : 'border-dashed bg-paper text-ink hover:bg-merino-dark'
                } ${current ? 'outline-3 outline-offset-2 outline-coral' : ''}`}
              >
                {index + 1}
                {flagged && (
                  <span aria-hidden="true" className="absolute -top-2.5 -right-1.5 text-base leading-none text-coral">
                    ⚑
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
