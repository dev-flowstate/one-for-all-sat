import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useSessionStore } from '../../store/useSessionStore';
import { getSelectionOffsets, getTextOffset, anyOverlap, mergeRanges, subtractRange } from '../../lib/highlighter/ranges';
import type { HighlightRange } from '../../lib/highlighter/ranges';
import { renderHighlighted } from '../../lib/highlighter/renderHighlighted';

interface HighlightableTextProps {
  text: string;
  /** Store key, e.g. `${question.id}:passage` or `${question.id}:prompt`. */
  rangeKey: string;
  className?: string;
  /** Parts of `text` shown underlined, for questions that ask about an underlined portion. */
  underlines?: HighlightRange[];
}

interface PopoverState {
  top: number;
  left: number;
  mode: 'add' | 'remove';
  range: HighlightRange;
}

// Stable reference so the Zustand selector below doesn't return a fresh `[]` on every
// render when there are no highlights yet — a new array each time makes useSyncExternalStore
// think the snapshot always changed, causing an infinite render loop.
const EMPTY_RANGES: HighlightRange[] = [];

/** Letters, digits and the joiners inside words ("don't", "well-known"). */
const WORD_CHAR = /[\p{L}\p{N}'’-]/u;

/** The whole word around a position in the source text, or null if it isn't in one. */
function wordAt(text: string, offset: number): HighlightRange | null {
  let start = offset;
  let end = offset;
  while (start > 0 && WORD_CHAR.test(text[start - 1])) start--;
  while (end < text.length && WORD_CHAR.test(text[end])) end++;
  return end > start ? { start, end } : null;
}

/** Where in the text a click landed. */
function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  if (document.caretPositionFromPoint) {
    const position = document.caretPositionFromPoint(x, y);
    return position && { node: position.offsetNode, offset: position.offset };
  }
  // Safari before 18.4 only has the older, non-standard version.
  const range = document.caretRangeFromPoint?.(x, y);
  return range ? { node: range.startContainer, offset: range.startOffset } : null;
}

/**
 * Renders plain text with highlight marks, highlighted one of two ways:
 *
 * - With the Highlighter tool on, as on the real test: selecting text highlights it the moment
 *   the selection ends, clicking a word highlights that word, and clicking a highlight removes
 *   it. The selection is cleared straight away, which also keeps browser menus that attach to
 *   selected text (Edge's, for one) from covering the passage.
 * - With it off: select text, and a floating "Highlight"/"Remove highlight" button appears.
 */
export function HighlightableText({ text, rangeKey, className = '', underlines }: HighlightableTextProps) {
  const ranges = useSessionStore((s) => s.highlights[rangeKey] ?? EMPTY_RANGES);
  const setHighlights = useSessionStore((s) => s.setHighlights);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLButtonElement>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const highlighterActive = useSessionStore((s) => s.highlighterActive);
  /** A drag ends in a click as well; that click mustn't highlight the word it ended on. */
  const justSelected = useRef(false);

  function highlightSelection() {
    const container = containerRef.current;
    const selection = window.getSelection();
    if (!container || !selection || selection.isCollapsed || selection.rangeCount === 0) return;
    const domRange = selection.getRangeAt(0);
    if (!container.contains(domRange.commonAncestorContainer)) return;
    const offsets = getSelectionOffsets(container, domRange);
    selection.removeAllRanges();
    if (offsets.end <= offsets.start) return;
    justSelected.current = true;
    setHighlights(rangeKey, mergeRanges([...ranges, offsets]));
  }

  function handleClick(e: ReactMouseEvent) {
    if (!highlighterActive) return;
    if (justSelected.current) {
      justSelected.current = false;
      return;
    }
    const container = containerRef.current;
    const caret = caretAt(e.clientX, e.clientY);
    if (!container || !caret || !container.contains(caret.node)) return;
    const offset = getTextOffset(container, caret.node, caret.offset);
    const hit = ranges.find((r) => offset >= r.start && offset <= r.end);
    if (hit) {
      setHighlights(rangeKey, ranges.filter((r) => r !== hit));
      return;
    }
    const word = wordAt(text, offset);
    if (word) setHighlights(rangeKey, mergeRanges([...ranges, word]));
  }

  function handleSelectionEnd() {
    if (highlighterActive) {
      highlightSelection();
      return;
    }
    const container = containerRef.current;
    const selection = window.getSelection();
    if (!container || !selection || selection.isCollapsed || selection.rangeCount === 0) {
      setPopover(null);
      return;
    }
    const domRange = selection.getRangeAt(0);
    if (!container.contains(domRange.commonAncestorContainer)) return;

    const offsets = getSelectionOffsets(container, domRange);
    if (offsets.end <= offsets.start) {
      setPopover(null);
      return;
    }

    const rect = domRange.getBoundingClientRect();
    setPopover({
      top: rect.top,
      left: rect.left + rect.width / 2,
      mode: anyOverlap(ranges, offsets) ? 'remove' : 'add',
      range: offsets,
    });
  }

  // Dismiss the floating button on any click/tap outside it and outside the text itself
  // (in-container clicks are already handled by the mouseup/touchend handlers below).
  useEffect(() => {
    if (!popover) return;
    function handleOutside(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || containerRef.current?.contains(target)) return;
      setPopover(null);
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [popover]);

  function commitPopover() {
    if (!popover) return;
    if (popover.mode === 'add') {
      setHighlights(rangeKey, mergeRanges([...ranges, popover.range]));
    } else {
      setHighlights(rangeKey, subtractRange(ranges, popover.range));
    }
    setPopover(null);
    window.getSelection()?.removeAllRanges();
  }

  return (
    <>
      <div
        ref={containerRef}
        className={`select-text whitespace-pre-wrap ${highlighterActive ? 'highlighter-on cursor-text' : ''} ${className}`}
        onMouseUp={handleSelectionEnd}
        onTouchEnd={handleSelectionEnd}
        onClick={handleClick}
      >
        {renderHighlighted(text, ranges, underlines)}
      </div>
      {popover && (
        <button
          ref={popoverRef}
          type="button"
          onClick={commitPopover}
          className="press fixed z-40 min-h-11 -translate-x-1/2 -translate-y-full border-2 border-ink bg-venice-blue px-3 py-1.5 font-mono text-xs font-bold tracking-tight text-merino uppercase shadow-[4px_4px_0_var(--color-ink)]"
          style={{ top: popover.top - 8, left: popover.left }}
        >
          {popover.mode === 'add' ? 'Highlight' : 'Remove highlight'}
        </button>
      )}
    </>
  );
}
