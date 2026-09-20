import type { ReactNode } from 'react';
import type { HighlightRange } from './ranges';

/** Pure string-slicing render — never dangerouslySetInnerHTML, so question content is never parsed as markup. */
export function renderHighlighted(text: string, ranges: HighlightRange[]): ReactNode[] {
  if (ranges.length === 0) return [text];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out: ReactNode[] = [];
  let cursor = 0;
  sorted.forEach((r, i) => {
    const start = Math.max(r.start, cursor);
    const end = Math.max(r.end, start);
    if (start > cursor) out.push(text.slice(cursor, start));
    if (end > start) {
      out.push(
        <mark key={`h-${i}`} className="highlight">
          {text.slice(start, end)}
        </mark>,
      );
    }
    cursor = Math.max(cursor, end);
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}
