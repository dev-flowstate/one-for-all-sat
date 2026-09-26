# One for All SAT

A personal SAT practice app styled after College Board's digital "Bluebook" app — topic/domain/skill drills across Math and Reading & Writing, a vocabulary flashcard deck, an answer eliminator, a text highlighter, a built-in graphing calculator, configurable timers, and persistent Wrong/Right review tabs.

**Live app:** https://dev-flowstate.github.io/one-for-all-sat/

## How it works

- **Everything runs client-side.** No login is required. Settings, points, streaks, and progress live in `localStorage`; the question bank lives in IndexedDB. Nothing is sent to a server unless you sign in.
- **Signing in is optional.** Without an account, everything is saved in this browser, as before. Sign in with Google under Profile & settings and your progress (answers, points, flashcards, practice tests, even a test in progress) is saved to your account and follows you to any device or browser you sign in on. The first sign-in adds what's already in the browser to the account; signing out removes it from the browser, so the next person on a shared computer can't see it.
- **Leaderboard.** Signed-in students are ranked by how many questions they've answered, on a page anyone can view (the trophy on the home screen). Each entry holds only a nickname, an avatar and two counts, in a public `leaderboard` collection that each person can write only for themselves; anyone can switch themselves off it in Profile.
- **Accounts use Firebase** (`src/lib/cloud/`): Google sign-in, and one Firestore record per person, holding their email so the data can be matched to the same Google account if it ever moves to another database. [`firestore.rules`](firestore.rules) lets each person read and write only their own record. The Firebase SDK is its own chunk and only downloads for people who sign in.
- **Questions ship with the app.** `public/question-bank.json` holds the full bank, Math and Reading & Writing, and loads on first visit, so there is nothing to set up. A small demo set (`src/data/bundled-bank/`) covers both subjects underneath it.
- **Importing is additive.** The shipped bank is *merged* into whatever you already have: it never deletes questions you imported yourself, and never re-adds one that's already stored. Duplicates are matched by id and, for questions that arrived under a different id, by their wording. Progress is keyed by question id and lives in `localStorage`, so questions you've already answered stay in Wrong or Right and never reappear in the unattempted pool. Corrections to questions already shipped go out by raising the file's `revision`: a browser that last loaded an older revision rewrites its stored copies once, keeping the same ids, so progress is untouched.
- **Import your own question bank.** Under Import, you can load a JSON file matching the schema in `src/lib/schema.ts` (`{ "questions": [...] }`) to add your own questions. Importing is additive too: it never removes anything, questions already present are updated in place, and progress is kept. Imported content is stored only in your browser.

## Topics

- **Practise by subtopic.** The setup page lists every domain with its subtopics (the 29 College Board uses). Tick whole domains or single subtopics; each shows how many you've done out of the total, the share you got right, and a **Weak** tag once it's low.
- **Weakest topics on the home screen,** with a page ranking every subtopic from weakest to strongest by the share answered wrong. A subtopic needs 5 answers before it's ranked, so one unlucky miss can't put it at the bottom. Each links straight to a practice set on just that subtopic.

## Full-length practice tests

Under **Full-length practice test** on the home page: a complete digital SAT, laid out as the real one is.

- **Timed or untimed**, chosen when you start. Untimed tests have no clocks: each module is submitted when you're done with it.
- **Reading and Writing, then Math**, each in two modules: 27 questions in 32 minutes, then 22 in 35. The domains follow College Board's shares, and the first module of each section is easy and medium questions while the second is medium and hard.
- **A 10-minute break** between the sections, which you can skip. Math never starts on its own, so stepping away for the whole break doesn't cost you time.
- **Answers stay open until the module ends.** Change them as often as you like, **mark questions for review**, and jump anywhere from the question grid. The end of each module shows what's blank and what's marked, and submitting early asks "Are you sure?" first. A module whose time runs out is submitted as it stands.
- **Saved as you go.** Close the tab or reload and it resumes on the same question with the same answers and time left; the clock only runs while the test is open. Every test you leave unfinished stays listed under **Saved tests** to resume or discard, and starting another never replaces one. Signed in, the list is the same on every device; where two devices hold the same test, the copy further along is kept.
- **Made from questions you haven't attempted.** When there aren't enough left, it asks before filling the gap with old ones.
- **Scored like the SAT:** 200–800 per section and 400–1600 in total, always a multiple of 10, with hard questions worth three times an easy one and medium twice. The results show where the misses were by section and domain, and every wrong question with its explanation. Wrong answers (blanks included) go to the Wrong tab, right ones to Right.
- Tests are numbered in order — Practice Test 1, 2, … — and past ones stay listed with their scores.
- **Named tests** have fixed questions, such as *Practice Test #1 for Hina* (all of Bluebook Practice Test 1: Reading and Writing, the break, then Math). They're adaptive like the real test: in each section, 17 of 27 (Reading and Writing) or 14 of 22 (Math) right in Module 1 gives the harder Module 2, fewer the easier one. A test covering one section is scored on that section alone. They're defined in `src/data/presetTests.ts`, and their questions live in a file of their own under `public/tests/`, loaded when the Practice tests page opens. They're not in the shipped bank, so they never count towards it or turn up in practice sets or generated tests.

## Maths questions

- **Equations are drawn as maths.** Question text marks equations as `\( … \)` in a small, fully-braced TeX subset — `\frac{a}{b}`, `\sqrt{x}`, `\sqrt[n]{x}`, `x^{2}`, `x_{1}`, `\overline{AB}` — and systems of equations as rows. `src/lib/math/` parses it and `src/components/math/` draws it: stacked fractions, radicals, raised exponents, italic variables, true minus signs. No TeX library; the renderer is smaller than one of a library's fonts. Text without the markup, including every English question, is shown exactly as before.
- **Tables are tables.** `\[table:<JSON rows>\]` marks a data table, in a question, an answer choice or an explanation; cells may hold equations of their own.
- **Highlighting still lines up.** A drawn fraction leaves different text in the page than it has in the question, so each equation and table carries its source length and the highlighter steps over it as one block.
- **Grid-in keypad.** Fill-in answers get a keypad with every character an answer can contain, since a phone's number pad has no fraction bar and, on iOS, no minus sign. It enforces the real answer box — 5 characters, 6 with a minus — and previews the answer as it will be read.

## Vocabulary flashcards

A separate section from the question drills, with its own decks and its own progress — practising vocabulary never touches your question pools, and resetting questions never touches your words.

- **991 words** (`src/data/vocab/`), one file per letter. The word on the front, its meaning and an example sentence on the back.
- **Grade yourself.** *Got it right* files the card into **Right** and retires it. *Got it wrong* files it into **Wrong** and sends it to the back of the current deck, so it comes round once more before you finish — once only, so a word you can't recall can't loop forever.
- **Cards you've graded leave the New deck** and stay out of it. Draw a new deck from New, Wrong, Right, or all 991, and reset any word (or a whole list) back to New from the review screen.
- Progress is saved in `localStorage` under `ofa-sat:vocab-progress`, per browser, like everything else here.

The definitions and example sentences were written for this app. They are not reproduced from SparkNotes, Barron's, or any other published word list.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build
npm run preview  # preview the production build locally
```

### Graphing calculator

The calculator pane opens Desmos's College Board version — the graphing calculator built into the digital SAT — embedded from desmos.com, on the left of the question as in Bluebook. A switch in its title bar changes to the built-in calculator below, which works offline.

#### Built-in calculator

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
