# Plan 023: Every row has actions, the action panel filters, History browses

> **Executor instructions**: Deliver the stated outcome within scope. Adapt routine
> implementation details to current code, preserve the listed contracts, and run
> the relevant acceptance checks. Fix task-caused failures and recheck affected
> behavior. Escalate only the material conditions below. Update the plan's status
> in `.factory/plans/README.md`.
>
> **Drift check**: `git diff --stat 46e64ea -- apps/app/src/mainview` and
> `git status --short`. The uncommitted launcher working tree at planning time
> is the baseline, plus plans 021 and 022 if they have landed. Confirm before
> starting: `components/launcher/actions/actions-menu.tsx` handles only
> ArrowUp/ArrowDown, Enter, Escape, Tab and `⌘K`;
> `components/launcher/views/use-root-keyboard.ts` `footerFor` returns
> `ACTIONS_HINT` only for `board`, `widget` and `connection`;
> `components/history/history-row.tsx` renders a single-line `LauncherRow`.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED (the action menu is shared by six callers)
- **Depends on**: `.factory/plans/021-one-surface-launcher.md` (the menu sits
  on the floating footer); soft on `022-root-results-rank-fallback-drafts.md`
  (the `draft` item kind; skip its actions if 022 has not landed)
- **Category**: direction
- **Planned at**: commit `46e64ea`, 2026-11-21, on `t3/remotion-video-app`
  with uncommitted launcher changes as the baseline

## Why this matters

In Raycast "Actions ⌘K" is on every screen for every row, so there is one
place to learn what a row can do. The panel names the row it acts on, lists
the primary action first with its key, filters as you type, and keeps its
filter field next to the button that opened it. In Conch `⌘K` works on widget,
board and connection rows only, the hint comes and goes with the selection,
and the menu cannot be filtered. History, the one list meant for browsing,
shows one line per ask and has no way to narrow to a connection. This plan
makes `⌘K` universal at the root, makes the panel searchable, gives ↵ and `⌘↵`
a consistent meaning, and turns History rows into two lines with a connection
filter.

## Current state

All paths are under `apps/app/src/mainview/`.

- `components/launcher/actions/menu-action.ts` — `MenuAction { id; label; icon;
tone: RowTone; disabled?; keys? }`.
  `components/launcher/actions/actions-menu.tsx` — `ActionsMenu<A>` with props
  `{ title; anchorId; actions; armedId; onRun; onClose }`. It is a focused
  `div role="menu"` (`tabIndex={-1}`, `aria-activedescendant`), selection via
  `useListSelection`, scale origin set from the anchor row (`useOriginAt`),
  and `actionsMenuHeight(count)` = `28 + count * 32 + 14 + 24`, which callers
  use to reserve body height. Items are `ActionMenuItem` (`role="menuitem"`,
  label, `KeyCombo` for `action.keys`, armed-delete label and draining
  hairline). Callers: `launcher/views/root-view.tsx` (catalog menu),
  `launcher/connections/connection-actions-menu.tsx`, `ask/ask-actions-layer.tsx`,
  `history/history-view.tsx`, `widgets/widget-run-view.tsx`,
  `board/board-tile.tsx`.

- Root menus: `launcher/views/use-catalog-menu.ts` (`{ armed, close, item,
open, run }` for widgets and boards; actions from
  `views/catalog-actions.ts`) and
  `launcher/connections/use-connection-actions-menu.ts` (actions from
  `connections/connection-actions.ts`). `root-view.tsx` `openActions` handles
  only those kinds:

  ```ts
  if (item.kind === "connection") {
    openConnectionMenu(item.connection.id);
  } else if (isCatalogItem(item)) {
    openCatalogMenu(item);
  }
  ```

- `launcher/views/use-root-keyboard.ts` — Enter runs the selected item whether
  or not `⌘` is held; `⌘K` opens actions; `⌘Y` opens History. `footerFor`
  decides the action label and hints per kind.

- `launcher/views/use-root-run.ts` — `runItem` per kind. `RootAskActions`
  (`root-view.tsx`) offers `start(prompt, target)` and
  `startSql(sql, target, title?)`, which runs SQL without the AI.

- History: `history/history-view.tsx` (input, list, menu, footer),
  `history-row.tsx` (one `LauncherRow`: icon, highlighted prompt, then
  `connection · title · when` as a subtitle capped at 55% width),
  `history-search.ts` (`historySections(entries, query, now)`,
  `HistoryEntry { ask; connectionName }`), `use-history-results.ts`,
  `use-history-keyboard.ts` (↵ ask again, `⌘K`, `⌘S`, `⌃X`, `⌘C`),
  `history-actions.ts` (seven actions, `keys` on four of them),
  `history-states.tsx` (skeleton rows are `h-10`). `RecentAsk` carries
  `prompt`, `sql`, `spec`, `connectionId`, `database`, `askedAt`.

- `launcher/launcher-row.tsx` — fixed `h-10`; props `{ id; selected; tone?;
describedBy?; onHover; onRun; children }`.
  `launcher/launcher-input.tsx` / `launcher-input-row.tsx` — `chip` on the
  left, the Run/Stop button on the right; no trailing slot.

- `lib/clipboard.ts` exports `copyText`; `lib/ipc.ts` exports
  `deleteRecentAsk`.

## Commands you will need

| Purpose      | Command                                                   | Expected                 |
| ------------ | --------------------------------------------------------- | ------------------------ |
| App tests    | `bun run --cwd apps/app test`                             | all pass (both projects) |
| One file     | `bun run --cwd apps/app test:browser <path>`              | pass                     |
| Types / lint | `bun run check-types`, `bun run check`                    | exit 0                   |
| e2e          | `bun run --cwd apps/app e2e`                              | all pass                 |
| Desktop      | `bun run --cwd apps/app desktop:dev` + `cua-driver` skill | manual checks below      |

## Implementation rules relevant to this plan

- Strict TS, no `any`. React 19, one component per file, about 6 props; when a
  component would exceed that, pass a typed object or compose with children.
- Action lists are pure functions returning `MenuAction[]` with a `*.test.ts`;
  running an action lives in a hook. Hotkeys live in `use…Keyboard` hooks.
- Destructive actions keep the existing armed confirm (press ↵ twice, draining
  hairline). Do not introduce a modal confirm.
- The menu stays `role="menu"` with `role="menuitem"` children so existing
  tests and e2e selectors hold. The filter input carries
  `aria-activedescendant` and a label ("Filter actions").
- Stored SQL is shown only where History already exposes it. Never show result
  rows.
- Copy: "Actions", "Filter actions…", "No matching actions",
  "All connections". Sentence case, no hype.

## Decisions taken in this plan (change before building if you disagree)

- **The filter field is always present** in the action panel, at the bottom,
  even for short menus. One behaviour is easier to learn than a threshold.
- **`⌘↵` runs the row's second action.** Raycast also has `⌥↵` for "do it and
  keep the window open"; it is not adopted because Conch's row actions already
  keep the panel open or hand off to a board window.
- **The History filter is by connection only**, toggled with `⌘P`.
- **History rows become two lines** (56pt): prompt, then connection and the
  first line of the stored query in the mono face. A separate detail pane was
  considered and deferred; the second line answers "which one is this?"
  without splitting the panel.

## UI and motion (mandatory)

Tokens from `lib/motion.ts` via `useMotionPreset()`; only `transform`,
`opacity`, `filter`.

| Moment             | Trigger                  | What moves                                                                                      | Token                       | Reduced motion |
| ------------------ | ------------------------ | ----------------------------------------------------------------------------------------------- | --------------------------- | -------------- |
| Panel opens        | `⌘K`                     | Existing scale from the anchor row; focus lands in the filter field.                            | `SPRING_SNAPPY`, `FADE_IN`  | Opacity only   |
| Filter actions     | Typing in the panel      | Items leave with a fade; the panel shrinks from the top (`layout`), the field does not move.    | `SPRING_SNAPPY`, `FADE_OUT` | Instant        |
| No matching action | Filter matches nothing   | A single muted line replaces the items.                                                         | `FADE_IN`                   | Instant        |
| Esc in the panel   | Esc with filter text     | Text clears and items return. A second Esc closes the panel the way it opened.                  | `SPRING_SNAPPY`             | Opacity only   |
| Scope filter opens | `⌘P` or click in History | Popover scales from its trigger at the top right; its field is at the top, next to the trigger. | `SPRING_SNAPPY`, `FADE_IN`  | Opacity only   |
| Scope chosen       | ↵ in the popover         | Trigger label `SwapText`s; rows filter with `layout`.                                           | `SPRING_SNAPPY`             | Instant        |
| Two-line rows      | History opens            | Existing first-open stagger, unchanged; only the row height differs.                            | `FADE_IN`, stagger          | Instant        |

Designed states to snapshot: panel with a divider before destructive actions,
panel filtered to one item, panel with no match, History with two-line rows,
History filtered to one connection, History filtered to a connection with no
asks, a row whose connection was removed.

## Scope

**In scope**

- `components/launcher/actions/`: `actions-menu.tsx`, `action-menu-item.tsx`,
  `menu-action.ts`, a new `actions-filter.ts` (+ test) and browser tests.
- A new `components/launcher/views/row-actions.ts` (+ test) and
  `use-row-actions-menu.ts` (+ browser test).
- `components/launcher/views/root-view.tsx`, `use-root-keyboard.ts`,
  `use-root-run.ts`, `catalog-actions.ts`,
  `launcher/connections/connection-actions.ts` (order and `keys` only).
- `components/launcher/launcher-row.tsx` (a `size` variant),
  `launcher-input.tsx`, `launcher-input-row.tsx` (a trailing slot).
- A new `components/launcher/scope-filter.tsx` (+ browser test).
- `components/history/`: `history-view.tsx`, `history-row.tsx`,
  `history-search.ts`, `use-history-results.ts`, `use-history-keyboard.ts`,
  `history-states.tsx`, `history-footer.tsx`, and their tests and snapshots.
- Height reservations in the other `ActionsMenu` callers
  (`ask/ask-actions-layer.tsx`, `widgets/widget-run-view.tsx`,
  `board/board-tile.tsx`) only where `actionsMenuHeight` changes them.
- `apps/app/e2e/history-flow.spec.ts`, `widget-flow.spec.ts`,
  `board-flow.spec.ts` and a new `apps/app/e2e/actions.spec.ts`.
- `CLAUDE.md` (Launcher UI, Widgets and History paragraphs),
  `.factory/plans/README.md` (status only).

**Out of scope**

- What existing actions do. This plan adds actions for kinds that had none and
  reorders lists; it does not change export, watch, delete or board behaviour.
- The ask view's own keys (`↵` refine, `⌘↵` new question) and its menu content.
- Board windows beyond keeping `board-tile.tsx` working with the new menu.
- A History detail pane, saved filters, or filtering by date.
- Pasting an answer into the app the user came from. It needs a native spike
  and is recorded in the README as deferred.

## Git workflow

- Branch `feat/launcher-023-actions-history`. Commit only if authorized; do
  not push or open a PR unless told to.

## Steps

### Step 1: Searchable action panel

Add `actions-filter.ts`: `filterActions(actions, query)` using `fuzzyMatch` on
`label`, preserving order (it filters, it does not re-rank). In `ActionsMenu`:

- Render an `<input aria-label="Filter actions" placeholder="Filter actions…">`
  as the last child, focused on open. Arrow keys, Enter, `⌘K` and Tab keep
  their current meaning from the input. Esc clears a non-empty filter first,
  then closes.
- The menu stays bottom-anchored so removing items shrinks it from the top.
- Insert one hairline before the first `tone: "destructive"` action.
- When the filter matches nothing, show "No matching actions"; Enter does
  nothing.
- Add the field's height to `actionsMenuHeight` and check each caller's
  reserved space still fits its longest menu.

**Evidence**: `actions-menu.browser.test.tsx` — typing narrows the list, Esc
clears then closes, Enter runs the highlighted match, a destructive action
still needs two presses, and `getByRole("menu")` / `getByRole("menuitem")`
still resolve. Run the existing tests of all six callers.

### Step 2: Actions for every root row

Add `row-actions.ts` with `rowActions(item, context): MenuAction[]` for the
kinds that have no menu today. The first action is always the row's ↵ action
and carries `keys: ["↩"]`; the second carries `keys: ["⌘", "↩"]`.

| Kind      | 1 (↵)        | 2 (`⌘↵`)        | Then                                              |
| --------- | ------------ | --------------- | ------------------------------------------------- |
| `ask`     | Ask          | —               | Copy Prompt                                       |
| `sql`     | Run          | Copy SQL        | —                                                 |
| `lookup`  | Find         | Copy Value      | —                                                 |
| `table`   | Preview Rows | Copy Table Name | Show Columns (`⌘↓`)                               |
| `recent`  | Ask Again    | Run SQL (no AI) | Copy SQL, Copy Prompt, Remove from History (`⌃X`) |
| `alert`   | Open         | —               | Dismiss (`⌫`)                                     |
| `command` | its label    | —               | —                                                 |
| `draft`   | Open Draft   | —               | Discard Draft (`⌃X`) — only if plan 022 landed    |

"Run SQL (no AI)" is disabled when the ask's connection no longer exists or
its language is not SQL, as in `history-actions.ts`. "Remove from History"
calls `deleteRecentAsk` and refreshes the widgets provider's recents.

Add `use-row-actions-menu.ts` (open, close, run, armed) modelled on
`use-catalog-menu.ts`, and extend `openActions` in `root-view.tsx` so every
kind opens a menu. Reorder `catalogActions` and `connectionActions` only as
needed so their first two entries are the ↵ and `⌘↵` actions, and add the
`keys`:

- widget: Run, Add to Board…
- board: Open, Rename
- connection: Use or Connect (new first entry mirroring ↵), Edit

`footerFor` returns `ACTIONS_HINT` for every selected item.

### Step 3: `⌘↵` runs the second action

In `useRootKeyboard`, `Enter` with `metaKey` runs the selected row's second
action when one exists and is enabled; otherwise it does nothing (it no longer
falls through to the primary action). Route it through the same run function
the menu uses so the two cannot diverge.

**Evidence**: browser tests — `⌘↵` on a recent row starts a no-AI SQL run;
`⌘↵` on a board opens rename; `⌘↵` on an Ask row does nothing; ↵ is unchanged
for every kind.

### Step 4: Two-line History rows

Give `LauncherRow` a `size?: "default" | "tall"` (40 / 56pt). In `HistoryRow`:

- Line 1: the highlighted prompt (`type-body`), with `when` in the trailing
  position (`type-meta`, tabular numerals).
- Line 2: connection name (italic "connection removed" when gone), a middle
  dot, then the first non-empty line of `ask.sql` with whitespace collapsed,
  in the mono face at `type-meta` size, truncated.

Update `HistorySkeleton` to the new height. Keep the card title searchable in
`history-search.ts` even though it is no longer shown.

### Step 5: Connection filter in History

Add a trailing slot to the input row (pass slots as one typed object if
`LauncherInput` would exceed six props). Add `ScopeFilter`: a trigger showing
the current scope and a chevron; `⌘P` or a click opens a popover under it with
a filter field at the top, "All connections" set apart as the first option,
then each connection that has at least one ask. ↑/↓, ↵ and Esc work as in the
action panel. Build it from the same searchable list `ActionsMenu` now uses,
so there is one implementation with the field at the top or the bottom.

`historySections` takes the chosen connection id and filters entries before
searching. The choice lasts while the view is mounted. A scope with no asks
shows "No asks on {name} yet." `use-history-keyboard.ts` handles `⌘P` and
prevents the default print action.

### Step 6: Docs and verification

Update `CLAUDE.md`: `⌘K` works on every root row, the panel filters, `⌘↵` is
the second action, History rows are two lines with a `⌘P` connection filter.
Run the command table and the desktop checks.

## Test plan

- Pure: `actions-filter.test.ts`, `row-actions.test.ts` (every kind, disabled
  cases), extended `history-search.test.ts` (connection scope),
  `catalog-actions` and `connection-actions` order.
- Browser: `actions-menu`, `use-row-actions-menu`, `scope-filter`,
  `history-view` (two-line rows, `⌘P`, scope with no asks), root view tests
  for `⌘K` on each kind and `⌘↵`. Model on
  `launcher/views/root-view-actions.browser.test.tsx` and
  `history/history-view.browser.test.tsx`.
- e2e `actions.spec.ts`: open `⌘K` on a recent row, filter to "Copy SQL", run
  it and assert the footer status; `history-flow.spec.ts`: filter by
  connection.
- Desktop: `⌘K` on each root kind; in a board window, a tile's menu still
  opens, filters and closes.

## Done criteria

- [ ] `bun run check-types`, `bun run check`, app tests and e2e pass; coverage
      at or above 80%.
- [ ] `⌘K` opens a menu on every root row kind, the footer always shows
      "Actions ⌘K" while a row is selected, and the first menu item is the ↵
      action.
- [ ] Typing in any action menu filters it; Esc clears, then closes; armed
      delete still takes two presses.
- [ ] `⌘↵` runs the second action where the table defines one and nothing
      elsewhere.
- [ ] History rows show the prompt, time, connection and first query line;
      `⌘P` narrows to a connection.
- [ ] The board tile menu and the ask and widget-run menus behave as before
      apart from the new filter field.
- [ ] Every row of the motion table has a browser test for both branches;
      Reduce Motion, Reduce Transparency and Increase Contrast verified;
      focus is never lost when a menu or popover closes.
- [ ] `git status` shows changes only in the in-scope files.

## STOP conditions

- Adding the filter input breaks focus return or the armed confirm in any of
  the six callers and the fix would change that caller's behaviour.
- `⌘↵` at the root conflicts with an existing binding found during
  implementation (it is unhandled in `use-root-keyboard.ts` at planning time).
- `⌘P` cannot be intercepted in the WKWebView (the print panel opens). Report
  it and propose another key; do not ship a filter with no keyboard path.
- Showing the stored query on line two raises a privacy concern beyond what
  History already shows through Copy SQL.

## Maintenance notes

- A new root item kind needs an entry in `rowActions` and in the `⌘↵` table,
  or `⌘K` opens an empty menu for it.
- If a menu grows past about ten actions, group them with a second divider
  rather than adding a second level.
- Reviewer focus: ARIA of the filter input inside `role="menu"`, and the
  board tile menu.
- Deferred: a History detail pane with the full query and a metadata table;
  "Paste into {app}" as a primary action.
