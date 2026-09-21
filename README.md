# One for All SAT

A personal SAT practice app styled after College Board's digital "Bluebook" app — topic/domain/skill drills across Math and Reading & Writing, an answer eliminator, a text highlighter, a built-in graphing calculator, configurable timers, and persistent Wrong/Right review tabs.

**Live app:** https://dev-flowstate.github.io/one-for-all-sat/

## How it works

- **Everything runs client-side.** No login is required. Settings, points, streaks, and progress live in `localStorage`; the question bank lives in IndexedDB. Nothing is sent to a server.
- **Local profile (optional).** You can set a nickname/avatar under Profile & Settings, but it's just a label saved in this browser — not a real account, no password, no sync across devices.
- **Bundled demo questions.** The app ships with a small set of original practice questions (`src/data/bundled-bank/`) so it's usable out of the box.
- **Import your own question bank.** Under Import, you can load a JSON file matching the schema in `src/lib/schema.ts` (`{ "questions": [...] }`) to add your own questions. Imported content is stored only in your browser and is never uploaded anywhere or committed to this repo.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build
npm run preview  # preview the production build locally
```

### Graphing calculator

The calculator is built into the app (`src/components/calculator/`, `src/lib/calculator/`) using [mathjs](https://mathjs.org/) for expression parsing and a canvas renderer for plotting — no API key, no external service, and it works offline. It plots `y = f(x)` expressions with pan/zoom (wheel, drag, pinch), evaluates plain arithmetic inline (`2+2*7` → `= 16`), and reports per-row parse errors. `log` is base 10 and `ln` is natural, matching SAT conventions. It's lazy-loaded, so its ~110 kB gzipped chunk only downloads the first time you open it.

Known limits: functions need parentheses (`sin(x)`, not `sin x`), only `y = f(x)` form (no implicit relations like `x^2 + y^2 = 9`), trig is in radians, and there are no sliders/tables/regressions.

## Deployment

Pushing to `main` builds the app and deploys it to GitHub Pages automatically via `.github/workflows/deploy.yml`.

## License

MIT — see [LICENSE](LICENSE). Covers the code only; it does not cover any question content you import locally.
