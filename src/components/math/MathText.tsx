import { Fragment } from 'react';
import { hasMarkup, splitSegments } from '../../lib/math/segments';
import { MathInline } from './MathInline';

/**
 * Question text that may contain equations and tables, for everywhere that isn't
 * highlightable — choices, explanations, review cards. Text with no markup comes back
 * untouched.
 */
export function MathText({ text }: { text: string }) {
  if (!hasMarkup(text)) return <>{text}</>;
  return (
    <>
      {splitSegments(text).map((segment, index) => {
        const length = segment.end - segment.start;
        switch (segment.kind) {
          case 'text':
            return <Fragment key={index}>{segment.value}</Fragment>;
          case 'math':
            return <MathInline key={index} tex={segment.tex} sourceLength={length} />;
          case 'table':
            return <QuestionTable key={index} rows={segment.rows} sourceLength={length} />;
        }
      })}
    </>
  );
}

interface QuestionTableProps {
  rows: string[][];
  /** Source characters it stands for, so the highlighter can step over it as one block. */
  sourceLength?: number;
}

/**
 * A data table from a question — "the table shows three values of x and their
 * corresponding values of y".
 *
 * Built from spans laid out as a table rather than a <table>, because tables turn up inside
 * answer choices and explanations whose containers are <span>s and <p>s, where a real table
 * is invalid markup. The ARIA roles give it the same structure for a screen reader.
 */
export function QuestionTable({ rows, sourceLength }: QuestionTableProps) {
  const columns = Math.max(1, ...rows.map((row) => row.length));
  // Tall tables label their columns across the top; wide ones label their rows down the
  // side — "x | 1 | 2 | 3" over "y | 5 | 7 | 9" — so that's where the header goes.
  const headerIsColumn = columns > rows.length;
  return (
    <span className="qtable-scroll" data-math-len={sourceLength}>
      <span className="qtable" role="table">
        {rows.map((row, r) => (
          <span key={r} className="qtable-row" role="row">
            {Array.from({ length: columns }, (_, c) => {
              const header = headerIsColumn ? c === 0 : r === 0;
              return (
                <span
                  key={c}
                  className={header ? 'qtable-head' : 'qtable-cell'}
                  role={header ? (headerIsColumn ? 'rowheader' : 'columnheader') : 'cell'}
                >
                  <MathText text={row[c] ?? ''} />
                </span>
              );
            })}
          </span>
        ))}
      </span>
    </span>
  );
}
