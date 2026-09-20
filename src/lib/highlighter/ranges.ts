export interface HighlightRange {
  start: number;
  end: number;
}

/**
 * Delegates to the browser's own Range-to-string serialization rather than manually
 * walking text nodes — correctly handles both text-node and element-node selection
 * boundaries without special-casing them.
 */
export function getTextOffset(container: Node, target: Node, targetOffset: number): number {
  const range = document.createRange();
  range.selectNodeContents(container);
  range.setEnd(target, targetOffset);
  return range.toString().length;
}

export function getSelectionOffsets(container: HTMLElement, range: Range): HighlightRange {
  const start = getTextOffset(container, range.startContainer, range.startOffset);
  const end = getTextOffset(container, range.endContainer, range.endOffset);
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

export function rangesOverlap(a: HighlightRange, b: HighlightRange): boolean {
  return a.start < b.end && b.start < a.end;
}

export function anyOverlap(ranges: HighlightRange[], target: HighlightRange): boolean {
  return ranges.some((r) => rangesOverlap(r, target));
}

export function mergeRanges(ranges: HighlightRange[]): HighlightRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: HighlightRange[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const curr = sorted[i];
    if (curr.start <= last.end) {
      last.end = Math.max(last.end, curr.end);
    } else {
      merged.push({ ...curr });
    }
  }
  return merged;
}

/** Removes `remove` from `ranges`, splitting any range it partially overlaps. */
export function subtractRange(ranges: HighlightRange[], remove: HighlightRange): HighlightRange[] {
  const result: HighlightRange[] = [];
  for (const r of ranges) {
    if (remove.end <= r.start || remove.start >= r.end) {
      result.push(r);
      continue;
    }
    if (remove.start > r.start) result.push({ start: r.start, end: Math.min(remove.start, r.end) });
    if (remove.end < r.end) result.push({ start: Math.max(remove.end, r.start), end: r.end });
  }
  return result.filter((r) => r.end > r.start);
}
