# One for All SAT

A personal SAT practice app styled after College Board's digital "Bluebook" app — topic/domain/skill drills across Math and Reading & Writing, an answer eliminator, a text highlighter, a Desmos graphing calculator, configurable timers, and persistent Wrong/Right review tabs.

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

### Desmos calculator

The graphing calculator needs a free API key from [desmos.com/my-api](https://www.desmos.com/my-api). Copy `.env.example` to `.env.local` and set `VITE_DESMOS_API_KEY`. Without a key, the calculator panel shows a clear "not configured" message instead of failing silently. For the deployed site, set `VITE_DESMOS_API_KEY` as a GitHub Actions repository secret (Settings → Secrets and variables → Actions) — it's read by `.github/workflows/deploy.yml` at build time.

## Deployment

Pushing to `main` builds the app and deploys it to GitHub Pages automatically via `.github/workflows/deploy.yml`.

## License

MIT — see [LICENSE](LICENSE). Covers the code only; it does not cover any question content you import locally.
