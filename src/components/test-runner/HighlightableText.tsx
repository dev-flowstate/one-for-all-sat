import { useEffect, useRef, useState } from 'react';
import { useSessionStore } from '../../store/useSessionStore';
import { getSelectionOffsets, anyOverlap, mergeRanges, subtractRange } from '../../lib/highlighter/ranges';
import type { HighlightRange } from '../../lib/highlighter/ranges';
import { renderHighlighted } from '../../lib/highlighter/renderHighlighted';

interface HighlightableTextProps {
  text: string;
  /** Store key, e.g. `${question.id}:passage` or `${question.id}:prompt`. */
  rangeKey: string;
  className?: string;
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

/**
 * Renders plain text with highlight marks and the select-to-highlight interaction:
 * select text -> a floating "Highlight"/"Remove highlight" button appears near the
 * selection -> clicking it commits the change to the session store.
 */
export function HighlightableText({ text, rangeKey, className = '' }: HighlightableTextProps) {
  const ranges = useSessionStore((s) => s.highlights[rangeKey] ?? EMPTY_RANGES);
  const setHighlights = useSessionStore((s) => s.setHighlights);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLButtonElement>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);

  function handleSelectionEnd() {
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
        className={`select-text whitespace-pre-wrap ${className}`}
        onMouseUp={handleSelectionEnd}
        onTouchEnd={handleSelectionEnd}
      >
        {renderHighlighted(text, ranges)}
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
