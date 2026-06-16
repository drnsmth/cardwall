# Cardwall

A browser-only card wall for offline planning and workshops. Import a CSV
exported from Jira (Cloud or on-prem), rearrange cards into columns and
swimlanes, edit fields, then export a CSV again. **No backend, no build step —
everything runs in the browser and your data never leaves it.**

## Run locally

The deployable site lives in `docs/` (that's also what GitHub Pages serves). It's
plain static files, but ES modules need to be served over HTTP (not `file://`).
Any static server works:

```sh
python3 -m http.server -d docs 8000
# then open http://localhost:8000
```

Import `docs/sample-jira.csv` to try it out.

## Development

```sh
npm install      # dev tooling + configures the git pre-commit hook
npm run check    # format + lint + types + duplication + unit tests (the gate)
npm test         # unit tests only
npm run test:e2e # browser end-to-end tests (needs Chrome; see below)
```

`npm install` points git at `.githooks` (via the `prepare` script), so a
pre-commit hook runs `npm run check` and blocks commits that don't pass. Bypass
once with `git commit --no-verify` if you must.

End-to-end tests live in `e2e/` and drive the real app in headless Chrome,
asserting on the DOM (not screenshots). They need Chrome installed — found via
the `chrome` channel, or set `PUPPETEER_EXECUTABLE_PATH`. They're kept out of
`npm run check` (slower, and need a browser + network for the CDN imports), so
run `npm run test:e2e` when changing UI behaviour.

## How it works

- **No build pipeline.** Libraries load as native ES modules from a CDN via the
  import map in `docs/index.html`. There is nothing to compile or bundle.
- **No GitHub Actions.** Push to `main` and enable GitHub Pages → _Deploy from a
  branch_ → `main` / `docs`. The files in `docs/` are the site; everything else
  (tests, configs, backlog) stays at the repo root and isn't published.
- **Types without a build.** Code is JavaScript with JSDoc annotations,
  type-checked in the editor via `jsconfig.json` (`tsc --noEmit`). No emit step.

## Libraries

| Concern                    | Library                        |
| -------------------------- | ------------------------------ |
| CSV parse/generate         | PapaParse                      |
| Drag & drop                | SortableJS                     |
| UI chrome (toolbar, modal) | Preact + htm + @preact/signals |

## Layout

```
docs/                  the deployable site (what Pages serves)
  index.html           import map + mount points
  app.js               bootstrap
  styles.css
  sample-jira.csv
  src/store.js         board model, config, localStorage persistence (signals)
  src/csv.js           Jira CSV import + export
  src/import.js        File -> parse -> load (shared by toolbar + empty state)
  src/colour.js        value -> palette colour map
  src/board.js         board rendering + SortableJS drag/drop (imperative)
  src/ui/toolbar.js    import/export/reset + field pickers (Preact)
  src/ui/card-edit.js  card editor modal: edit/delete (Preact)
test/                  unit tests (node --test)
e2e/                   browser end-to-end tests
```

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. Settings → Pages → _Deploy from a branch_ → `main`, folder `/docs`.
3. Visit `https://<user>.github.io/<repo>/`.

Only `docs/` is published. All asset paths are relative (`./…`) so it works under
the repo subpath.
