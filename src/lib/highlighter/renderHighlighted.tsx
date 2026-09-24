import type { ReactNode } from 'react';
import type { HighlightRange } from './ranges';
import { hasMarkup, splitSegments } from '../math/segments';
import { MathInline } from '../../components/math/MathInline';
import { QuestionTable } from '../../components/math/MathText';

/**
 * Pure string-slicing render — never dangerouslySetInnerHTML, so question content is never parsed as markup.
 * `underlines` are drawn under the text without changing it, so highlight offsets still line up.
 */
export function renderHighlighted(
  text: string,
  ranges: HighlightRange[],
  underlines: HighlightRange[] = [],
): ReactNode[] {
  if (!hasMarkup(text)) return highlightSlice(text, 0, text.length, ranges, underlines, 'h');

  // Equations are atomic: a highlight touching any part of one covers all of it, because
  // half a fraction isn't a thing anyone means to mark. Tables are atomic too, and are never
  // wrapped in a highlight at all — a yellow wash over a grid of numbers hides the grid.
  const out: ReactNode[] = [];
  splitSegments(text).forEach((segment, index) => {
    if (segment.kind === 'text') {
      out.push(...highlightSlice(text, segment.start, segment.end, ranges, underlines, `h${index}`));
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

/** Renders `text[from, to)` with the parts inside `ranges` wrapped in <mark>, and the parts
 *  inside `underlines` in <u>. */
function highlightSlice(
  text: string,
  from: number,
  to: number,
  ranges: HighlightRange[],
  underlines: HighlightRange[],
  prefix: string,
): ReactNode[] {
  if (underlines.some((u) => u.start < to && from < u.end)) {
    return decoratedSlice(text, from, to, ranges, underlines, prefix);
  }
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

/**
 * The general case, with underlines as well as highlights: the slice is cut at every edge of
 * either, and each piece wrapped in whichever of the two covers it.
 */
function decoratedSlice(
  text: string,
  from: number,
  to: number,
  ranges: HighlightRange[],
  underlines: HighlightRange[],
  prefix: string,
): ReactNode[] {
  const cuts = new Set([from, to]);
  for (const r of [...ranges, ...underlines]) {
    if (r.start > from && r.start < to) cuts.add(r.start);
    if (r.end > from && r.end < to) cuts.add(r.end);
  }
  const edges = [...cuts].sort((a, b) => a - b);
  const covers = (list: HighlightRange[], a: number, b: number) => list.some((r) => r.start <= a && b <= r.end);

  const out: ReactNode[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const [a, b] = [edges[i], edges[i + 1]];
    let piece: ReactNode = text.slice(a, b);
    if (covers(underlines, a, b)) {
      piece = (
        <u key={`${prefix}-u${i}`} className="decoration-1 underline-offset-[3px]">
          {piece}
        </u>
      );
    }
    if (covers(ranges, a, b)) {
      piece = (
        <mark key={`${prefix}-m${i}`} className="highlight">
          {piece}
        </mark>
      );
    }
    out.push(piece);
  }
  return out;
}
