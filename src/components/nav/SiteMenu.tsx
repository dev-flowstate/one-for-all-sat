import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';

const SECTIONS: { title: string; links: { to: string; label: string }[] }[] = [
  {
    title: 'Study',
    links: [
      { to: '/', label: 'Home & study plan' },
      { to: '/setup', label: 'Practice questions' },
      { to: '/topics', label: 'Topics' },
      { to: '/tests', label: 'Practice tests' },
      { to: '/vocab', label: 'Vocabulary' },
      { to: '/read', label: 'Reading' },
    ],
  },
  {
    title: 'Your work',
    links: [
      { to: '/wrong', label: 'Wrong & right questions' },
      { to: '/doodles', label: 'Saved doodles' },
      { to: '/activity', label: 'Activity log' },
    ],
  },
  {
    title: 'More',
    links: [
      { to: '/leaderboard', label: 'Leaderboard' },
      { to: '/resources', label: 'Resources' },
      { to: '/profile', label: 'Profile & settings' },
    ],
  },
];

/** Mid-question screens have their own Exit, and a menu there would only invite losing your place. */
const HIDDEN_ON = ['/run', '/test', '/vocab/drill'];

/**
 * The part of the page that's on the screen. Zoomed in with a pinch, the screen shows only a
 * panned window onto the area `position: fixed` is measured from, so a drawer pinned to that
 * area's left edge would open off to the side, out of sight.
 */
function onScreen(): CSSProperties | undefined {
  const view = window.visualViewport;
  return view ? { left: view.offsetLeft, top: view.offsetTop, width: view.width, height: view.height } : undefined;
}

/** The ☰ Menu button at the top left of every page, and the drawer it opens. */
export function SiteMenu() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const first = useRef<HTMLAnchorElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [placement, setPlacement] = useState<CSSProperties>();

  // A link was followed: the drawer has done its job.
  const [openedOn, setOpenedOn] = useState(pathname);
  if (openedOn !== pathname) {
    setOpenedOn(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    // Without preventScroll, focusing scrolls whatever it takes to show the element. Zoomed in,
    // that panned the whole view across to the link and left the page shifted sideways once
    // the menu closed.
    first.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    // The drawer keeps to the screen if the zoomed view is panned or zoomed while it's open.
    const view = window.visualViewport;
    const follow = () => setPlacement(onScreen());
    view?.addEventListener('scroll', follow);
    view?.addEventListener('resize', follow);
    const opener = button.current;
    return () => {
      window.removeEventListener('keydown', onKey);
      view?.removeEventListener('scroll', follow);
      view?.removeEventListener('resize', follow);
      opener?.focus({ preventScroll: true });
    };
  }, [open]);

  if (HIDDEN_ON.includes(pathname)) return null;

  return (
    <>
      <div className="mx-auto max-w-6xl px-3 pt-3 sm:px-4">
        <button
          ref={button}
          type="button"
          onClick={() => {
            setPlacement(onScreen());
            setOpen(true);
          }}
          aria-expanded={open}
          aria-controls="site-menu"
          className="press inline-flex min-h-10 items-center gap-2 border-2 border-ink bg-paper px-3 font-mono text-xs font-bold tracking-tight uppercase shadow-[3px_3px_0_var(--color-ink)] hover:bg-merino-dark"
        >
          <span aria-hidden="true" className="text-base leading-none">
            ☰
          </span>
          Menu
        </button>
      </div>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-50" style={placement}>
            <div aria-hidden="true" className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
            <nav
              id="site-menu"
              aria-label="Site menu"
              className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r-2 border-ink bg-paper shadow-[6px_0_0_var(--color-ink)]"
            >
              <div className="flex flex-none items-center justify-between border-b-2 border-ink bg-venice-blue px-4 py-3 text-merino">
                <span className="font-mono text-xs font-bold tracking-tight uppercase">Menu</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="flex h-8 w-8 items-center justify-center border-2 border-merino font-mono text-sm font-bold hover:bg-merino hover:text-venice-blue"
                >
                  ✕
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                {SECTIONS.map((section, s) => (
                  <div key={section.title} className="mb-4">
                    <p className="mb-1.5 px-1 text-[10px] font-semibold tracking-tight text-ink-soft uppercase">
                      {section.title}
                    </p>
                    <ul className="flex flex-col gap-1">
                      {section.links.map((link, i) => (
                        <li key={link.to}>
                          <NavLink
                            ref={s === 0 && i === 0 ? first : undefined}
                            to={link.to}
                            end
                            className={({ isActive }) =>
                              `block border-2 px-3 py-2 font-mono text-xs font-bold tracking-tight uppercase ${
                                isActive
                                  ? 'border-ink bg-venice-blue text-merino'
                                  : 'border-transparent hover:border-ink hover:bg-merino-dark'
                              }`
                            }
                          >
                            {link.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </nav>
          </div>,
          document.body,
        )}
    </>
  );
}
