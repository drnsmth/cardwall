# Backlog

Prioritised, incremental work for Cardwall. We pull from the top. Each item is a
thin vertical slice meant to ship in ~1–2 small atomic commits, test-first, with
`npm run check` green (see the workflow in CLAUDE.md).

**Per-item template**

- **Value** — who benefits and the outcome.
- **AC** — concrete, testable acceptance criteria (these become the first tests).
- **Size** — S / M / L. If it can't ship in ~1–2 atomic commits, split it.
- **Notes** — constraints, dependencies, and what's explicitly out of scope.

Status: `[ ]` todo · `[~]` in progress · `[x]` done.

## Now

- [ ] **Import from the empty state**
  - Value: a first-time user with a blank board can start without hunting for
    the toolbar control.
  - AC: the "No cards yet" view offers an import affordance; using it runs the
    same parse + load flow and the board renders the imported cards.
  - Size: S
  - Notes: reuse the toolbar's import handler — don't duplicate the file→parse
    logic (jscpd will catch it if we do).

- [ ] **Reset / clear board**
  - Value: start over without manually clearing browser storage.
  - AC: a Reset control empties the board after a confirm; cards and config
    return to defaults and the `cardwall.v1` localStorage key is cleared;
    refreshing stays empty.
  - Size: S
  - Notes: confirm before destroying data.

- [ ] **Pre-commit hook running `npm run check`**
  - Value: the quality gate runs automatically, so a red commit can't land.
  - AC: committing with a failing gate is blocked locally; a clean tree commits
    normally; setup works from a fresh `npm install`.
  - Size: S
  - Notes: prefer the lightest option that needs no new heavy dependency. Stays
    consistent with the README's "No GitHub Actions" stance (local, not CI).

## Next

- [ ] **Story-point totals per column**
  - Value: see capacity per column at a glance during planning.
  - AC: each column header shows the sum of a numeric field (default
    "Story Points") alongside the card count; non-numeric/blank values are
    ignored; updates as cards move.
  - Size: M
  - Notes: column header currently shows only the count.

- [ ] **Choose which fields show on the card face**
  - Value: tailor cards to the planning conversation.
  - AC: a toolbar control toggles which headers appear on cards; the board
    reflects changes live; the choice persists across reload.
  - Size: M
  - Notes: `config.displayFields` exists but is hardcoded; no picker yet.

- [ ] **Pick the active sprint from multi-`Sprint` exports**
  - Value: real Jira exports (issues carried across sprints emit several
    `Sprint` columns) group by the current sprint, not an arbitrary one.
  - AC: given duplicate `Sprint` columns, grouping/derived value uses the last;
    single-`Sprint` exports are unchanged; covered by csv/store tests.
  - Size: M
  - Notes: duplicate headers are already preserved on import.

- [ ] **Quick filter / search**
  - Value: focus on a subset (e.g. one assignee, a keyword) on a busy board.
  - AC: a search input hides non-matching cards across all columns/swimlanes;
    clearing it restores everything; column counts reflect the filtered view.
  - Size: M

## Later

- [ ] **Card colour by a field**
  - Value: visually distinguish issue types / priorities.
  - AC: cards are tinted by a chosen field's value; the mapping persists across
    reload (no colour loss on refresh).
  - Size: M

- [ ] **WIP limit per column**
  - Value: surface overloaded columns during planning.
  - AC: an optional per-column limit shows a visual warning when exceeded;
    limits persist; no limit = no warning.
  - Size: M

- [ ] **DOM-level tests for the board render layer**
  - Value: cover `board.js`, currently the untested DOM edge.
  - AC: a lightweight DOM (jsdom/linkedom) lets `node --test` assert that render
    produces the expected columns/cards and wires drag handlers; runs in
    `npm run check`.
  - Size: L
  - Notes: keeps the no-build runtime intact — test-only dependency.
