import type { ReactNode } from 'react';
import type { HighlightRange } from './ranges';
import { hasMarkup, splitSegments } from '../math/segments';
import { MathInline } from '../../components/math/MathInline';
import { QuestionTable } from '../../components/math/MathText';

/** Pure string-slicing render — never dangerouslySetInnerHTML, so question content is never parsed as markup. */
export function renderHighlighted(text: string, ranges: HighlightRange[]): ReactNode[] {
  if (!hasMarkup(text)) return highlightSlice(text, 0, text.length, ranges, 'h');

  // Equations are atomic: a highlight touching any part of one covers all of it, because
  // half a fraction isn't a thing anyone means to mark. Tables are atomic too, and are never
  // wrapped in a highlight at all — a yellow wash over a grid of numbers hides the grid.
  const out: ReactNode[] = [];
  splitSegments(text).forEach((segment, index) => {
    if (segment.kind === 'text') {
      out.push(...highlightSlice(text, segment.start, segment.end, ranges, `h${index}`));
      return;
    }
    if (segment.kind === 'table') {
      out.push(<QuestionTable key={`t${index}`} rows={segment.rows} sourceLength={segment.end - segment.start} />);
      return;
    }
    const math = <MathInline key={`m${index}`} tex={segment.tex} sourceLength={segment.end - segment.start} />;
    const lit = ranges.some((r) => r.start < segment.end && segment.start < r.end);
    out.push(
      lit ? (
        <mark key={`m${index}`} className="highlight">
          {math}
        </mark>
      ) : (
        math
      ),
    );
  });
  return out;
}

/** Renders `text[from, to)` with the parts inside `ranges` wrapped in <mark>. */
function highlightSlice(
  text: string,
  from: number,
  to: number,
  ranges: HighlightRange[],
  prefix: string,
): ReactNode[] {
  const clipped = ranges
    .map((r) => ({ start: Math.max(r.start, from), end: Math.min(r.end, to) }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);
  if (clipped.length === 0) return from < to ? [text.slice(from, to)] : [];

  const out: ReactNode[] = [];
  let cursor = from;
  clipped.forEach((r, i) => {
    const start = Math.max(r.start, cursor);
    const end = Math.max(r.end, start);
    if (start > cursor) out.push(text.slice(cursor, start));
    if (end > start) {
      out.push(
        <mark key={`${prefix}-${i}`} className="highlight">
          {text.slice(start, end)}
        </mark>,
      );
    }
    cursor = Math.max(cursor, end);
  });
  if (cursor < to) out.push(text.slice(cursor, to));
  return out;
}
