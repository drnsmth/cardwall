# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run check                  # gate: format + lint + types + dupes + UNIT tests
npm test                       # unit tests (node --test, test/ only)
node --test test/csv.test.js   # run a single unit test file
npm run test:e2e               # browser end-to-end tests (e2e/, needs Chrome)
npm run typecheck              # tsc on JSDoc types via jsconfig.json (no emit)
npm run lint                   # eslint .            (lint:fix to auto-fix)
npm run format                 # prettier --write    (format:check to verify only)
npm run dupes                  # jscpd duplication scan

python3 -m http.server 8000    # serve locally — open http://localhost:8000
```

There is **no build step**. The deployed site is the source files as-is. ES modules require an HTTP server (not `file://`). Import `sample-jira.csv` to exercise the app.

### Code quality gates

`npm run check` is the single gate and must be green before any commit. It chains, in order: Prettier (`format:check`), ESLint (`eslint .`), `tsc` (strict, JSDoc-typed — keep it at **zero** errors), jscpd (duplication; `.jscpd.json` fails on any clone ≥ 50 tokens), then the test suite. Run it after each change, not just at the end. The tooling deps (eslint, prettier, typescript, jscpd, `@types/*`) are real `devDependencies` and must be `npm install`ed locally — unlike the runtime libs, which load from the CDN import map. Because the runtime code is JS-with-JSDoc, `tsc` only stays useful if new functions carry `@param`/`@returns` annotations; the DOM edges (`board.js`, the Preact UI) use inline `/** @type {...} */` casts at the browser boundary.

## Working style: test-first (TDD) and XP

Write code **test-first**, following the red-green-refactor cycle:

1. **Red** — write the smallest failing test that expresses the next behavior. Run it and confirm it fails for the right reason (`node --test test/<file>.test.js`).
2. **Green** — write the minimum code to make it pass. Resist adding anything the test doesn't demand.
3. **Refactor** — clean up code _and_ tests with the suite green, then re-run.

Apply this in practice here:

- **Put logic in pure, testable cores.** The codebase already splits this way — `parseCsvText`/`exportCsv` are pure (no DOM/`File`), while `importCsv`/`downloadText` are thin browser wrappers. New behavior belongs in a pure function with `node --test` coverage; keep DOM/SortableJS/Preact glue as thin, hard-to-test edges.
- **Drive store logic from tests too** — `src/store.js` imports safely under Node (no `localStorage`), so functions like `loadCards`, `moveCard`, `syncColumns`, `distinctValues` can be tested directly. Add tests alongside `test/csv.test.js` and `test/store.test.js`.
- **Test behavior, not implementation** — assert on inputs/outputs (e.g. round-tripping CSV, sentinel `(no value)` handling), mirroring the existing tests, so refactors don't break the suite.
- **Verify UI with e2e tests, not ad-hoc scripts or screenshots.** For DOM/rendering behaviour that unit tests can't reach (`board.js`, the Preact UI), add a committed test in `e2e/` that drives the app in headless Chrome and asserts on the **DOM and values** (`page.$eval`, `getComputedStyle`, element counts) — never by eyeballing a screenshot. The harness (`e2e/support/harness.js`) provides a static server, browser launcher, and `openBoard()` seeding helper. E2E is the slow top of the pyramid: keep coverage thin and run it via `npm run test:e2e` (it needs Chrome + network), separate from the fast pre-commit gate.
- **Keep the gates green before any commit.** Run `npm run check` (format + lint + types + dupes + tests); never commit on red.

XP values to keep front of mind: **simplicity** (do the simplest thing that passes — YAGNI; no speculative config/abstraction), **feedback** (small steps, run tests constantly), **communication** (intention-revealing names and the existing JSDoc types), and **courage to refactor** (the tests are the safety net that makes that safe).

### Version control: trunk-based development

Commit directly to `main` (the trunk) in **small, atomic** increments — one logical change per commit — and integrate frequently. No long-lived feature branches; if something is genuinely large, use a short-lived branch merged back quickly. Every commit must stand on its own with `npm run check` green. The red→green→refactor steps map naturally onto separate small commits. `main` is also the deploy branch (GitHub Pages, root), so it must stay releasable at all times.

## Architecture

Browser-only Jira card wall: import a Jira CSV, rearrange cards into columns/swimlanes, edit fields, export CSV again. No backend; data lives only in the browser (localStorage). Dependencies load as native ES modules from a CDN via the import map in `index.html` — `package.json` deps exist only for type-checking, not bundling. Code is JavaScript with JSDoc types, checked by `tsc` (`checkJs`, `strict`).

### Two rendering systems, kept deliberately apart

- **Preact (declarative)** owns the _chrome_: `src/ui/toolbar.js` and `src/ui/card-edit.js`, mounted into separate DOM roots (`#toolbar`, `#modal-root`).
- **Plain imperative DOM + SortableJS** owns the _board_ (`src/board.js`, mounted into `#board`).

They are separated because SortableJS mutates the DOM during drag, which would conflict with Preact's vdom diffing. Do not render board cards with Preact. `mountBoard` runs inside a signals `effect`; on any change to `cards`/`config` it tears down **all** Sortable instances and rebuilds the board (`destroySortables` → `render`).

### State: signals store (`src/store.js`)

Single source of truth is two `@preact/signals` signals: `cards` and `config`. An `effect` mirrors them to `localStorage` (key `cardwall.v1`) on every change. The `restoring` flag suppresses writes during initial `restore()` (called once in `app.js` before mounting). The store is guarded to import safely in Node (tests) where `localStorage` is absent.

**Column ordering** (`orderColumnValues` → `syncColumns`) is a smart default: if any column value contains a digit (e.g. `Sprint 2`, `Sprint 10`) the values are natural-sorted so `2` precedes `10`; otherwise they keep first-seen order so workflow fields like `Status` stay in CSV order instead of alphabetising. Blank-valued cards collapse into a single trailing `(no value)` column (the backlog). Users can drag column **headers** to override this order (`board.js` → `reorderColumns`); the custom order lives in `config.columns` and persists via the localStorage effect until the next import or change of column field. `syncColumns` only runs on import and column-field change — not on card moves/edits — so a manual order is not clobbered by dragging cards.

A **Card** carries both raw imported data and derived position:

- `fields` — the raw Jira CSV row (never mutated by drag/drop).
- `column` / `swimlane` — the card's _current_ position, seeded from `fields[columnField]` on import but changed independently when dragged.

So moving a card updates `column`/`swimlane` only; `exportCsv` reflects the current `column` back into `fields[columnField]` at export time (see below). Editing a card (`updateCard`) patches `fields`.

### CSV (`src/csv.js`)

`parseCsvText` is the pure, testable core; `importCsv` is the thin `File`→text browser wrapper. Two Jira-specific behaviors that tests pin down:

- **Card id** comes from `pickKeyField` ("Issue key" / "Key" / "Issue Key"), falling back to `row-<index>`.
- **Duplicate headers** (Jira often exports several "Labels" columns) are kept distinct — PapaParse suffixes them and we preserve those keys.

`exportCsv` writes the original headers in order and folds the current `column` back into `columnField`, mapping the sentinel `(no value)` → empty string. `(no value)` is the placeholder used throughout for cards/columns with an empty field value.

### Flow

`app.js` calls `restore()`, then mounts toolbar, board, and modal. Toolbar import → `loadCards` (resets board, picks columnField, seeds positions). Changing "Columns by"/"Swimlanes by" re-seeds every card's `column`/`swimlane` from the chosen field. Drag end → `moveCard`. Double-click a card → `openCardEditor` → modal → `updateCard`.

## Deploy

Push to `main`, enable GitHub Pages (_Deploy from a branch_ → `main` / root). All asset paths are relative so it works under a repo subpath. `.nojekyll` is present so Pages serves files verbatim.
