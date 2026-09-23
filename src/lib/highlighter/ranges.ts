export interface HighlightRange {
  start: number;
  end: number;
}

/** Set on a rendered equation or table: how many source characters it stands for. */
const MATH_ATTR = 'data-math-len';

/**
 * Delegates to the browser's own Range-to-string serialization rather than manually
 * walking text nodes — correctly handles both text-node and element-node selection
 * boundaries without special-casing them.
 *
 * That only holds while the page's text is the source text. A drawn equation isn't: a
 * stacked `\frac{3}{4}` leaves "34" in the page for thirteen source characters, and every
 * highlight after it would land in the wrong place. So when equations are present the
 * offset is counted by walking the tree instead, with each equation counted as a block of
 * its source length, and a boundary that falls inside one snapped to its edge.
 */
export function getTextOffset(
  container: Node,
  target: Node,
  targetOffset: number,
  bias: 'start' | 'end' = 'end',
): number {
  if (!(container instanceof Element) || !container.querySelector(`[${MATH_ATTR}]`)) {
    const range = document.createRange();
    range.selectNodeContents(container);
    range.setEnd(target, targetOffset);
    return range.toString().length;
  }

  const math = mathAncestor(target, container);
  if (math) {
    const before = lengthBefore(container, math);
    return bias === 'start' ? before : before + mathLength(math);
  }
  if (target.nodeType === Node.TEXT_NODE) return lengthBefore(container, target) + targetOffset;
  const children = target.childNodes;
  if (targetOffset < children.length) return lengthBefore(container, children[targetOffset]);
  return target === container ? sourceLength(container) : lengthBefore(container, target) + sourceLength(target);
}

export function getSelectionOffsets(container: HTMLElement, range: Range): HighlightRange {
  const start = getTextOffset(container, range.startContainer, range.startOffset, 'start');
  const end = getTextOffset(container, range.endContainer, range.endOffset, 'end');
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

function mathLength(element: Element): number {
  return Number(element.getAttribute(MATH_ATTR)) || 0;
}

function isMath(node: Node): node is Element {
  return node instanceof Element && node.hasAttribute(MATH_ATTR);
}

/**
 * The outermost block `node` sits in. Outermost, not nearest: an equation inside a table
 * cell is itself a block, but the table is what the highlighter steps over as a whole.
 */
function mathAncestor(node: Node, container: Node): Element | null {
  let found: Element | null = null;
  for (let n: Node | null = node; n && n !== container; n = n.parentNode) {
    if (isMath(n)) found = n;
  }
  return found;
}

/** How many source characters a subtree stands for. */
function sourceLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent?.length ?? 0;
  if (isMath(node)) return mathLength(node);
  let total = 0;
  node.childNodes.forEach((child) => {
    total += sourceLength(child);
  });
  return total;
}

/** Source characters before `target`, in document order within `container`. */
function lengthBefore(container: Node, target: Node): number {
  let total = 0;
  const visit = (node: Node): boolean => {
    if (node === target) return true;
    if (node.nodeType === Node.TEXT_NODE || isMath(node)) {
      total += sourceLength(node);
      return false;
    }
    for (const child of Array.from(node.childNodes)) {
      if (visit(child)) return true;
    }
    return false;
  };
  for (const child of Array.from(container.childNodes)) {
    if (visit(child)) break;
  }
  return total;
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
