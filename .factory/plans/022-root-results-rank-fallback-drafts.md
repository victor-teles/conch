# Plan 022: Root results rank across kinds, never dead-end, and keep drafts

> **Executor instructions**: Deliver the stated outcome within scope. Adapt routine
> implementation details to current code, preserve the listed contracts, and run
> the relevant acceptance checks. Fix task-caused failures and recheck affected
> behavior. Escalate only the material conditions below. Update the plan's status
> in `.factory/plans/README.md`.
>
> **Drift check**: `git diff --stat 46e64ea -- apps/app/src/mainview` and
> `git status --short`. The uncommitted launcher working tree at planning time
> is the baseline, plus plan 021 if it has landed. Confirm before starting:
> `components/launcher/views/root-items.ts` exports `buildRootSections` and
> builds the sections `alerts, recent, widgets, boards, connections, commands`
> in that order; `filterWidgets`, `filterConnections` and `filterCommands` each
> return plain item arrays; `query` state lives in `LauncherStackView`
> (`components/launcher/launcher-panel.tsx`).

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED (changes what the root shows for every typed query)
- **Depends on**: `.factory/plans/021-one-surface-launcher.md` (soft: section
  spacing and the steady height make the flat list read well; this plan works
  without it)
- **Category**: direction
- **Planned at**: commit `46e64ea`, 2026-11-21, on `t3/remotion-video-app`
  with uncommitted launcher changes as the baseline

## Why this matters

When you type at the root, Conch filters each section separately and keeps the
section order, so the best match can sit under three headers and four worse
rows. Raycast collapses to one ranked list the moment you type, labels each
row's kind at the trailing edge, always offers somewhere to send the query
when nothing matches, selects the old query when you come back to it, and
keeps a form you abandoned as a draft. This plan brings those five behaviours
to the root without changing what ↵ does for a typed question.

## Current state

All paths are under `apps/app/src/mainview/`.

- `components/launcher/views/root-items.ts` — `RootItem` union (`command,
connection, ask, widget, recent, board, alert, sql, table, lookup`),
  `RootSection { id; label; items }` and `buildRootSections`. With a query it
  returns `[...leadingSections(ask, typed, lookup), ...clipboard, ...matched]`
  where `matched` is the non-empty subset of:

  ```ts
  { id: "alerts", items: alertItems(alerts, query), label: "Alerts" },
  { id: "recent", items: recentItems(recents, query), label: "Recent" },
  { id: "widgets", items: widgetItems, label: "Widgets" },
  { id: "boards", items: boardItems, label: "Boards" },
  { id: "connections", items: connectionItems, label: "Connections" },
  { id: "commands", items: commandItems, label: "Commands" },
  ```

  `alertItems` and `recentItems` already return `[]` when a query is typed.
  Boards match with `name.toLowerCase().includes(needle)`; the other three use
  `fuzzyMatch` (`lib/fuzzy-match.ts`, returns `{ score, matches } | null`).
  When nothing matches and no AI provider is set up, the only row is the
  `aiSetup` command.

- `components/widgets/widget-search.ts` (`filterWidgets`),
  `components/launcher/connections/connection-search.ts` (`filterConnections`,
  `sortConnections`), `components/launcher/root-commands.ts` (`filterCommands`,
  `rootCommands`, `LauncherCommand { id; title; subtitle; icon; actionLabel;
shortcut?; keywords?; run }`). Each computes a score internally, sorts, and
  drops the score.

- `components/launcher/views/use-root-sections.ts` — parses the input
  (`parseLauncherInput` in `launcher/input-mode.ts`: `>` SQL, `#` table, `@`
  connection, otherwise `search`). Only `search` mode calls `buildRootSections`.

- `components/launcher/views/root-list.tsx` — renders sections with
  `LauncherSection`; shows `LauncherNoResults` when there are none.
  `root-item-row.tsx` switches on `item.kind` to `WidgetRow`, `AlertRow`,
  `BoardRow`, `RecentRow`, `AskRow`, `SqlRow`, `TableRow`, `LookupRow`,
  `ConnectionRow`, `CommandRow`.

- Rows put everything on the left. `components/widgets/recent-row.tsx` shows
  `prompt` then `connectionName ?? ask.spec.title` as a subtitle;
  `components/board/board-row.tsx` shows the name then `tileCount(...)` as a
  subtitle; `launcher/command-row.tsx` shows a shortcut at the trailing edge.

- `components/launcher/views/use-root-run.ts` (`runItem` switch),
  `use-root-keyboard.ts` (`useRootKeyboard`, `footerFor`), `root-view.tsx`
  (composition). The placeholder is
  `"Search or ask… > SQL · # table · @ connection"`.

- `components/launcher/launcher-panel.tsx` — `query` survives push and pop.
  `onShown` refocuses the input and, after `RESET_AFTER_HIDDEN_MS` (60 s
  hidden), resets the stack and the query. Nothing selects the text.

- `components/launcher/views/connection-edit-view.tsx` renders
  `<ConnectionForm connection={connection} key={connectionId ?? "new"}
onSuccess={handleSuccess} />`. `components/connection-form/use-connection-form.ts`
  holds the form in `useState<FormState>` seeded from the connection or
  `INITIAL_STATE` (`connection-form-state.ts`); it is lost when the view
  unmounts. `FormState` includes `password`.

- `components/launcher/connections/connections-provider.tsx` and
  `connections-reducer.ts` own connection state for every view
  (`ConnectionsState { load; connections; activeId; liveIds; activity; focusId }`).

- CLAUDE.md product rule to preserve: "free text at root shows an
  'Ask {connection}' row first; ↵ pushes the `ask` view."

## Commands you will need

| Purpose      | Command                                                    | Expected                 |
| ------------ | ---------------------------------------------------------- | ------------------------ |
| App tests    | `bun run --cwd apps/app test`                              | all pass (both projects) |
| One file     | `bun run --cwd apps/app test:unit <path>` / `test:browser` | pass                     |
| Types / lint | `bun run check-types`, `bun run check`                     | exit 0                   |
| e2e          | `bun run --cwd apps/app e2e`                               | all pass                 |
| Desktop      | `bun run --cwd apps/app desktop:dev` + `cua-driver` skill  | manual checks below      |

## Implementation rules relevant to this plan

- Strict TS, discriminated unions for variants, no `any`. React 19, one
  component per file, about 6 props at most, no boolean prop proliferation:
  row components must not grow a `showKind` flag each (see Step 2).
- Ranking, fallbacks and draft detection are pure functions with `*.test.ts`
  files. Components and hooks get `*.browser.test.tsx`.
- A draft holds a password. It lives in renderer memory only: never in
  `localStorage`, never sent to bun, never logged, gone when the app quits.
- Copy is quiet and literal: "Results", "Use “{query}” with…", "Drafts",
  "Open Draft", "Discard Draft", "Draft". No exclamation marks.
- `⌃X` is already the remove key in History; reuse it for discarding a draft.
- Announce result counts through a live region, never per frame.

## Decisions taken in this plan (change before building if you disagree)

- **Ask and Look up stay first.** A typed question must always run on ↵, so
  the leading rows keep their place and only the rows below them are flattened
  and ranked. Letting a strong name match outrank the Ask row was considered
  and rejected: a question that happens to resemble a widget's name would run
  the widget.
- **Flattening applies to `search` mode with a non-empty query only.** The
  resting root keeps its sections; `>`, `#` and `@` modes are unchanged.
- **Drafts cover the New Connection form only**, the one long form in the
  launcher. Editing an existing connection is not drafted.
- **Fallbacks are two rows**: search History for the text, and find a table by
  it (only with an active SQL connection).

## UI and motion (mandatory)

Tokens from `lib/motion.ts` via `useMotionPreset()`; only `transform`,
`opacity`, `filter`.

| Moment             | Trigger                        | What moves                                                                                 | Token                       | Reduced motion |
| ------------------ | ------------------------------ | ------------------------------------------------------------------------------------------ | --------------------------- | -------------- |
| Sections → Results | First character typed          | Rows keep their identity (`layout="position"` already on `LauncherRow`) and slide to rank. | `SPRING_SNAPPY`             | Instant        |
| Re-rank            | Further typing                 | Rows reorder; leaving rows fade. No stagger.                                               | `SPRING_SNAPPY`, `FADE_OUT` | Instant        |
| Kind label         | List becomes flat              | Trailing label fades in with the row; it does not shift the title.                         | `FADE_IN`                   | Instant        |
| Results → sections | Query cleared                  | Rows return to their sections; headers fade in.                                            | `SPRING`, `FADE_IN`         | Instant        |
| Draft appears      | Back from a dirty form         | "Drafts" section reveals at the top once per change (`RevealWhenChanged`).                 | `SPRING_SOFT`               | Instant        |
| Draft discarded    | `⌃X`                           | Row fades; the list closes the gap.                                                        | `FADE_OUT`, `SPRING`        | Instant        |
| Return to root     | Pop with a query, or re-summon | No motion. The query text is selected.                                                     | —                           | —              |

Designed states to snapshot: resting root (sections), typed with mixed kinds
(flat, with kind labels and a count), typed with no matches (Ask + fallbacks),
typed with no matches and no AI provider (setup + fallbacks), a draft present.

## Scope

**In scope**

- `components/launcher/views/root-items.ts` (+ test): `draft` item kind,
  flat ranking, fallback section.
- A new `components/launcher/views/root-ranking.ts` (+ test).
- `components/widgets/widget-search.ts`, `launcher/connections/connection-search.ts`,
  `launcher/root-commands.ts` (+ their tests): export scored ranking next to
  the existing filters.
- `components/launcher/launcher-list.tsx`: optional `count` on `LauncherSection`.
- A new `components/launcher/row-trailing.tsx` and
  `launcher/views/root-list-layout.tsx` (context) (+ browser tests);
  `root-list.tsx`, `root-item-row.tsx`, `widgets/recent-row.tsx`,
  `board/board-row.tsx`, `widgets/widget-row.tsx`,
  `launcher/connections/connection-row.tsx`, `launcher/command-row.tsx`.
- A new `components/launcher/views/draft-row.tsx` (+ browser test).
- `components/launcher/views/use-root-sections.ts`, `use-root-run.ts`,
  `use-root-keyboard.ts`, `root-view.tsx`, `launcher/launcher-no-results.tsx`.
- `components/launcher/use-launcher-stack.ts` (+ test): `history` view gains an
  optional initial query; `launcher/launcher-panel.tsx`;
  `history/history-view.tsx` (accept the initial query).
- `components/launcher/connections/connections-reducer.ts` (+ test),
  `connections-provider.tsx`, `connection-form/use-connection-form.ts`,
  `connection-form/index.tsx`, `launcher/views/connection-edit-view.tsx`
  (+ tests).
- `apps/app/e2e/input-modes.spec.ts`, `connection-flow.spec.ts` and a new
  `apps/app/e2e/root-results.spec.ts`.
- `CLAUDE.md` (Launcher UI and Connections paragraphs),
  `.factory/plans/README.md` (status only).

**Out of scope**

- The Ask row's position and what ↵ does on it.
- `>`, `#` and `@` modes, the table panes, lookup classification.
- Action menus and `⌘K` for the new rows: plan 023.
- Persisting drafts to disk; drafts for editing an existing connection, for
  widget inputs or for board names.
- An "update available" row. It needs a background network check, which is a
  product decision recorded in the README, not part of this plan.

## Git workflow

- Branch `feat/launcher-022-root-results`. Commit only if authorized; do not
  push or open a PR unless told to.

## Steps

### Step 1: Rank across kinds (pure)

In each search module export a scored variant beside the filter, for example
`rankWidgets(widgets, query): { item: Widget; score: number }[]`, and make the
existing `filter*` a map over it so there is one scoring path. Give boards a
`fuzzyMatch` on their name instead of `includes`.

Add `root-ranking.ts` with `rankRootItems(scored: { item: RootItem; score:
number }[]): RootItem[]`: sort by score descending, break ties by kind order
`widget, board, connection, command`, then by original order. In
`buildRootSections`, when `prompt` is non-empty, replace `matched` with one
section `{ id: "results", label: "Results", items }`. Add `"results"`,
`"fallbacks"` and `"drafts"` to `RootSection["id"]`.

**Evidence**: `root-items.test.ts` — a query matching a command strongly and a
widget weakly lists the command first; an empty query still returns the six
resting sections in today's order; Ask and Look up stay ahead of Results.

### Step 2: Trailing column and kind labels

Add `RowTrailing` (`type-meta text-panel-muted tabular-nums shrink-0`,
right-aligned, never wraps) and a `RootListLayout` context with the value
`"sectioned" | "flat"`, provided by `RootList` from whether the Results section
is present. `RowTrailing` takes `kind: string` and optional children; it shows
the children always and the kind label only when the layout is `flat`.

- `RecentRow`: connection name moves to the trailing column; the subtitle
  becomes `ask.spec.title`.
- `BoardRow`: the tile count moves to the trailing column.
- `WidgetRow`, `ConnectionRow`, `CommandRow`: keep their trailing content
  (trend, pin and indicator, shortcut) and add the kind label through
  `RowTrailing` ("Widget", "Connection", "Command"; boards say "Board").

`LauncherSection` gets an optional `count`; the Results header reads
"Results" followed by the count in `type-micro` muted numerals.

### Step 3: Fallbacks, so the root never dead-ends

After Results (or directly after the leading rows when nothing matched), add a
section labelled `Use “{query}” with…` built from generated `LauncherCommand`s:

- "Search History" — pushes `{ kind: "history", query }`; `HistoryView` seeds
  its input from it.
- "Find Table" — only with an active SQL connection; sets the root query to
  `#{query}`.

They are ordinary `command` items, so `CommandRow`, `runItem` and `footerFor`
need no new branch. The existing `aiSetup` row keeps leading when no provider
is configured. If `LauncherNoResults` can no longer render in `search` mode,
keep it only if another mode still reaches it; otherwise delete it and its test.

Add three commands to `rootCommands` that teach the input modes: "Run SQL"
(subtitle `>`), "Browse Tables" (subtitle `#`), "Switch Connection" (subtitle
`@`). Each sets the root query to its prefix and keeps focus in the input. The
subtitle renders in the mono face.

### Step 4: Remember the query

In `RootView`, select the input's text when the view mounts with a non-empty
query (returning from a pushed view). In `launcher-panel.tsx` `onShown`, select
the text after focusing when the query is non-empty and the stack was not
reset. Esc still clears; typing replaces.

### Step 5: Connection drafts

- Reducer: `ConnectionsState.draft: FormState | null` with actions
  `draft-kept` and `draft-cleared`; `saved` also clears it. Expose `draft`,
  `keepDraft` and `discardDraft` from the provider.
- Form: `useConnectionForm` accepts an initial `FormState` and reports the
  latest form when it unmounts unsaved. Do not write to the provider on every
  keystroke. A form is dirty when it differs from `INITIAL_STATE`; a clean
  form leaves no draft.
- `ConnectionEditView` (new connection only): seed from the draft, keep it on
  leave, clear it on save.
- Root: a `draft` `RootItem` and a "Drafts" section placed first at rest and
  while typing. `DraftRow` shows "New Connection", the draft's name or host as
  subtitle, and "Draft" in the trailing column. ↵ opens the form
  (`actionLabel` "Open Draft"); `⌃X` discards; the footer shows the
  `⌃X Discard` hint.

**Evidence**: browser test — type a host, press Esc, the root shows the draft;
↵ restores the typed host; saving removes the row; `⌃X` removes the row and a
new form opens clean.

### Step 6: Docs and verification

Update `CLAUDE.md`: typed search is one ranked Results list under the Ask row,
fallbacks follow, the New Connection form keeps an in-memory draft. Run the
command table and the desktop checks.

## Test plan

- Pure: `root-ranking.test.ts`, extended `root-items.test.ts`,
  `widget-search`, `connection-search` and `root-commands` tests for the
  scored variants, `connections-reducer.test.ts` for the draft actions.
- Browser: `row-trailing`, `draft-row`, `root-view` (flat list, kind labels,
  count, fallbacks, text selected on return), `connection-edit-view` (draft
  round trip). Model on `launcher/views/root-view.browser.test.tsx`.
- e2e `root-results.spec.ts`: type a query matching a command and a widget and
  assert order and labels; type nonsense and run "Search History"; abandon a
  New Connection form and reopen the draft.
- Desktop: with a real connection, type a widget's name prefix and confirm it
  is the first Results row under Ask; quit and relaunch and confirm the draft
  is gone.

## Done criteria

- [ ] `bun run check-types`, `bun run check`, app tests and e2e pass; coverage
      at or above 80%.
- [ ] With a query, rows below Ask and Look up form one "Results" section
      ordered by score, each with a trailing kind label; without a query the
      root is unchanged except for the trailing column on recents and boards.
- [ ] A query that matches nothing still offers "Search History" (and "Find
      Table" with a SQL connection); the root never renders an empty list in
      `search` mode.
- [ ] ↵ on a typed question still asks the active connection.
- [ ] Returning to the root with a query selects it.
- [ ] An abandoned New Connection form reappears as a draft, restores every
      field, and is gone after save, discard or relaunch.
      `rg -n "localStorage|sessionStorage" apps/app/src/mainview/components/connection-form apps/app/src/mainview/components/launcher/connections`
      returns nothing new.
- [ ] Every row of the motion table has a browser test for both branches;
      Reduce Motion, Reduce Transparency and Increase Contrast verified.
- [ ] `git status` shows changes only in the in-scope files.

## STOP conditions

- Fuzzy scores are not comparable across kinds in practice (for example every
  command outranks every widget because keywords match at word starts). Report
  examples; propose a per-kind weight before inventing a new scorer.
- Keeping ↵ on the Ask row conflicts with a test or a documented flow that
  expects a matching widget to run on ↵.
- The draft cannot be captured on unmount without lifting form state out of
  `useConnectionForm` wholesale. Report the smallest lift before doing it.
- Any path would write the draft, and so a password, outside renderer memory.

## Maintenance notes

- A new root item kind must join the tie-break order in `root-ranking.ts` and
  get a kind label, or it sorts last and shows no label.
- Plan 023 gives every row an action menu; `draft` gets "Open Draft" and
  "Discard Draft" there, and `⌃X` should run the same discard.
- Reviewer focus: the ranking tests, and that no draft data reaches bun.
- Deferred: drafts for other forms (generalize on the second form that needs
  one), and frecency ranking of the resting root.
