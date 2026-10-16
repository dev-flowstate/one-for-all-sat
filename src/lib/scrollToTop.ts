/**
 * Putting a newly opened screen at its top, and keeping it there against a scroll still gliding
 * from the screen before.
 *
 * A flick on a laptop's touchpad keeps scrolling for a second or more after the fingers lift:
 * the system goes on sending the page wheel events until the glide dies away, even once the page
 * has reached its end. Flick down to a button at the bottom of a page, press it while the glide
 * is still going, and the glide carries on into the screen the button opens, running it from its
 * top down to its bottom. A reset when the screen opens can't stop that, as the glide goes on
 * after it, and those wheel events can't be cancelled. So while they keep coming, the screen
 * can't be scrolled at all.
 */

/** Wheel events closer together than this are one glide still going. */
const GLIDE_GAP_MS = 150;
/** A wheel event this soon before a screen opened may be a glide whose next events are held up
 *  while the screen is drawn. */
const BEFORE_MS = 300;
/** One this soon after can't be someone scrolling the new screen, which they've hardly seen yet:
 *  it's a glide from before. */
const AFTER_MS = 150;
/** However long the wheel keeps going, the screen is let go after this. */
const MAX_HOLD_MS = 3000;

let lastWheel = -Infinity;
/** When a screen last opened, and what scrolls on it. */
let openedAt = -Infinity;
let opened: HTMLElement[] = [];
/** The scrollers held still, with the overflow each had before. */
const held = new Map<HTMLElement, string>();
let heldAt = 0;
let frame = 0;

function hold(scrollers: HTMLElement[]) {
  for (const el of scrollers) {
    if (!held.has(el)) held.set(el, el.style.overflowY);
    el.style.overflowY = 'hidden';
    if (el.scrollTop !== 0) el.scrollTop = 0;
  }
  heldAt = performance.now();
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(letGoWhenStill);
}

/** Checked as each frame is drawn, after that frame's wheel events have arrived: on a timer
 *  instead, a page busy drawing would hold them back and the glide would seem to have stopped. */
function letGoWhenStill() {
  const now = performance.now();
  if (now - Math.max(lastWheel, heldAt) < GLIDE_GAP_MS && now - heldAt < MAX_HOLD_MS) {
    frame = requestAnimationFrame(letGoWhenStill);
    return;
  }
  for (const [el, overflow] of held) el.style.overflowY = overflow;
  held.clear();
}

window.addEventListener(
  'wheel',
  () => {
    const now = performance.now();
    if (now - openedAt < AFTER_MS) hold(opened);
    lastWheel = now;
  },
  { passive: true, capture: true },
);

// Anything the glide moved before it was held goes straight back to the top.
window.addEventListener(
  'scroll',
  (e) => {
    const el = e.target === document ? document.documentElement : (e.target as HTMLElement);
    if (held.has(el) && el.scrollTop !== 0) el.scrollTop = 0;
  },
  { passive: true, capture: true },
);

/** Scrolls the window, and the pane given if any, to the top, and holds them there while a
 *  glide from before is still arriving. */
export function scrollToTop(pane?: HTMLElement | null) {
  window.scrollTo(0, 0);
  pane?.scrollTo(0, 0);
  opened = [document.documentElement];
  // Only a pane that scrolls by itself: hiding the overflow of one that doesn't would clip it.
  if (pane && /auto|scroll/.test(getComputedStyle(pane).overflowY)) opened.push(pane);
  openedAt = performance.now();
  if (openedAt - lastWheel <= BEFORE_MS) hold(opened);
}
