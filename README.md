# Cardwall

A browser-only card wall for offline planning and workshops. Import a CSV
exported from Jira (Cloud or on-prem), rearrange cards into columns and
swimlanes, edit fields, then export a CSV again. **No backend, no build step —
everything runs in the browser and your data never leaves it.**

## Run locally

It's plain static files, but ES modules need to be served over HTTP (not
`file://`). Any static server works:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Import `sample-jira.csv` to try it out.

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
  import map in `index.html`. There is nothing to compile or bundle.
- **No GitHub Actions.** Push to `main` and enable GitHub Pages → _Deploy from a
  branch_ → `main` / root. The pushed files are the site.
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
index.html        import map + mount points
app.js            bootstrap
src/store.js      board model, config, localStorage persistence (signals)
src/csv.js        Jira CSV import + export
src/board.js      board rendering + SortableJS drag/drop (imperative)
src/ui/toolbar.js import/export + column/swimlane field pickers (Preact)
src/ui/card-edit.js  double-click card editor modal (Preact)
```

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. Settings → Pages → _Deploy from a branch_ → `main`, folder `/ (root)`.
3. Visit `https://<user>.github.io/<repo>/`.

All asset paths are relative (`./…`) so it works under the repo subpath.
