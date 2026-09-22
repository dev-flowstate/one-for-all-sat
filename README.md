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

The calculator is built into the app (`src/components/calculator/`, `src/lib/calculator/`) using [mathjs](https://mathjs.org/) for expression parsing and a canvas renderer for plotting — no API key, no external service, and it works offline. It's lazy-loaded, so its chunk only downloads the first time you open it.

Supported:

- **Functions and relations** — `y = 2x + 3`, a bare `x^2 - 4`, implicit relations like `x^2 + y^2 = 25`, and inequalities like `y > 2x + 1` (shaded, dashed boundary when strict)
- **Points of interest** — roots, intersections, extrema, and y-intercepts are found numerically and marked on the graph; hover or tap one to read its coordinates
- **Definitions and sliders** — `a = 5` gets a slider, `f(x) = x^2 + 3x - 4` can then be reused by later rows (`f(5)`, `y = f(x) + 1`)
- **Restrictions** — `y = x^2 {0 < x < 5}`
- **Angle mode** — RAD/DEG toggle; inverse trig returns degrees in degree mode
- **Data tables and regressions** — enter or paste (from a spreadsheet) paired data into a table, then fit it with a `~` row: `y_1 ~ m*x_1 + b`, `y_1 ~ a*x_1^2 + b*x_1 + c`, `y_1 ~ a*b^x_1`, or any model you write. Shows the fitted parameters, R², and r, draws the fit over the scatter, and makes the fitted parameters usable by later rows. `r` is only reported for straight-line fits, where it's actually meaningful.
- **Inline arithmetic** — a row with no `x` shows its value (`2+2*7` → `= 16`)
- **SAT function set** — `sqrt`, `nthroot`, `abs`, `!`, `nCr`/`nPr`, `mean`/`median`/`stdev`/`stdevp`/`min`/`max`, `floor`/`ceil`/`round`/`sign`, `mod`/`gcd`/`lcm`, lists, and trig/hyperbolic functions. `log` is base 10 and `ln` is natural, matching SAT conventions.
- Pan/zoom by wheel, drag, or pinch, plus `+` / `−` / reset buttons

Not supported (deliberately — none of it appears on the SAT): 3D graphing, matrices, complex numbers, polar coordinates, and animations. Functions also need parentheses (`sin(x)`, not `sin x`).

## Deployment

Pushing to `main` builds the app and deploys it to GitHub Pages automatically via `.github/workflows/deploy.yml`.

## License

MIT — see [LICENSE](LICENSE). Covers the code only; it does not cover any question content you import locally.

Made by Muhammad Salar Khan.
