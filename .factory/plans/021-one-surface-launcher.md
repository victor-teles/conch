# Plan 021: The launcher reads as one surface with a floating footer

> **Executor instructions**: Deliver the stated outcome within scope. Adapt routine
> implementation details to current code, preserve the listed contracts, and run
> the relevant acceptance checks. Fix task-caused failures and recheck affected
> behavior. Escalate only the material conditions below. Update the plan's status
> in `.factory/plans/README.md`.
>
> **Drift check**: `git diff --stat 46e64ea -- apps/app/src/mainview` and
> `git status --short`. About 50 launcher files were modified but uncommitted
> at planning time; that working tree is the baseline. Confirm before starting:
> `components/launcher/launcher-footer.tsx` renders a `<footer>` with
> `border-t border-panel-border`; `components/launcher/launcher-scroll-area.tsx`
> exists and wraps a `motion.div` with `layoutScroll`;
> `components/launcher/launcher-list.tsx` has `gap-1` on the listbox;
> `components/launcher/launcher-surface.tsx` sets `borderRadius: 16`.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (touches the chrome of every launcher view)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `46e64ea`, 2026-11-21, on `t3/remotion-video-app`
  with uncommitted launcher changes as the baseline

## Why this matters

A study of Raycast's panel (2026-11-21) showed why it feels calmer than
Conch's: it is one surface. There is no line under the search field and no
footer bar. The footer is two floating capsules, the list scrolls under them
with a fade, and the window never changes height while you type. Conch draws a
hairline under the input and a bordered 36pt footer, so a panel with one result
reads as three stacked strips, and the footer (with the action label the eye is
tracking) moves on every keystroke that narrows the list. This plan removes the
strips, floats the footer, and holds the root height steady while a query is
being typed. The ask flow's height morph, which is the product's signature, is
not touched.

## Current state

All paths are under `apps/app/src/mainview/`.

- `components/launcher/launcher-footer.tsx` — the footer every view renders.
  Props are the contract to keep: `{ status: ReactNode; actionLabel: string |
null; actionKeys?: readonly string[]; hints?: readonly FooterHint[] }`. Today:

  ```tsx
  <footer className="flex h-9 shrink-0 items-center justify-between gap-3 border-t border-panel-border px-4 type-meta text-panel-muted">
    <div className="flex min-w-0 items-center gap-2">{status}</div>
    <div className="flex shrink-0 items-center gap-3">…action + hints…</div>
  </footer>
  ```

  It has 14 callers: `launcher/views/{root-view,settings-view,board-picker-view,connection-edit-view,board-name-view}.tsx`,
  `ask/ask-view.tsx`, `watches/{watch-view,watches-view,watch-panel}.tsx`,
  `bundle/import-footer.tsx`, `lookup/lookup-view.tsx`,
  `history/history-footer.tsx`, `widgets/{widget-inputs-view,widget-run-view}.tsx`.

- The hairline under the input is a `border-t border-panel-border` on each
  view's body element. Find them with
  `rg -n "border-t border-panel-border" apps/app/src/mainview/components`.
  The view-body hits are: `launcher/views/root-view.tsx:337`,
  `settings-view.tsx:27`, `board-picker-view.tsx:130`,
  `connection-edit-view.tsx:84`, `board-name-view.tsx:91`, `ask/ask-view.tsx:175`,
  `watches/watch-view.tsx:21`, `watches/watches-view.tsx:90`,
  `watches/watch-panel.tsx:108`, `bundle/import-view.tsx:91`,
  `lookup/lookup-view.tsx:96`, `history/history-view.tsx:96`,
  `widgets/widget-inputs-view.tsx:134`, `widgets/widget-run-view.tsx:207`.
  Other hits (`watches-view.tsx:102`, `import-widget-row.tsx`,
  `widget-inputs-view.tsx:123`, `preset-pill.tsx`, `card-table.tsx`, anything
  under `board/`) are dividers inside content and stay.

- `components/launcher/launcher-scroll-area.tsx` — `motion.div` with
  `min-h-0 overflow-y-auto` and `layoutScroll`; no edge fade. Callers:
  `launcher/views/root-body.tsx`, `board-picker-view.tsx`,
  `launcher/schema/table-panes.tsx`, `watches/watches-view.tsx`,
  `lookup/lookup-view.tsx`, `history/history-view.tsx`.

- `components/launcher/launcher-list.tsx` — `LauncherListbox` is
  `flex flex-col gap-1 px-2 pb-2`; `LauncherSection` header is
  `px-2.5 pt-1 pb-1.5 type-micro text-panel-muted`.
  `components/launcher/launcher-row.tsx` rows are `h-10`, selection is
  `absolute inset-0 rounded-[10px]` with `layoutId="launcher-selection"`.
  So rows sit on a 44pt pitch (40 + 4 gap); Raycast's are contiguous.

- `components/launcher/launcher-surface.tsx` — the panel: `launcher-material`,
  `borderRadius: 16`, Motion `layout` with `originY: 0`, `maxHeight` from
  `panel-height.ts` (`LIST_PANEL_MAX_HEIGHT = 476`, `PANEL_MAX_HEIGHT = 680`).
  `use-window-height-sync.ts` measures the panel and calls `resizeLauncher`;
  it grows the native window immediately and shrinks it after the layout
  animation settles. Do not change that contract.

- `components/launcher/stack-view-frame.tsx` — each view is wrapped in a
  transformed `motion.div` (`flex min-h-0 flex-col`). A transformed element is
  the containing block for absolutely positioned descendants, so a footer
  positioned `absolute` inside a view is placed against that view's frame and
  travels with it during push and pop.

- `components/launcher/views/root-view.tsx` — the body wrapper already takes a
  `minHeight` (`listMinHeight`, lines 290–294 and 336–339) to make room for
  popovers. `query` is owned by `LauncherStackView` in `launcher-panel.tsx` and
  is cleared by Esc through `onClearQuery`.

- `components/launcher/actions/actions-menu.tsx` — popover, `absolute right-3
bottom-3 z-10 w-64`, rendered inside the body wrapper.

- `index.css` — `@utility launcher-material` (panel, blur 24px, opaque under
  `prefers-reduced-transparency`), `@utility popover-material` (solid),
  tokens `--panel`, `--panel-solid`, `--panel-raised`, `--panel-border`,
  `--panel-highlight`, `--panel-muted`, `--row-hover`, `--row-active`, and the
  type utilities `type-input|title|body|meta|micro`.

## Commands you will need

| Purpose      | Command                                                   | Expected                 |
| ------------ | --------------------------------------------------------- | ------------------------ |
| App tests    | `bun run --cwd apps/app test`                             | all pass (both projects) |
| One file     | `bun run --cwd apps/app test:browser <path>`              | pass                     |
| Snapshots    | `bun run --cwd apps/app test:browser -- -u`               | review the diff as code  |
| Types / lint | `bun run check-types`, `bun run check`                    | exit 0                   |
| e2e          | `bun run --cwd apps/app e2e`                              | all pass                 |
| Desktop      | `bun run --cwd apps/app desktop:dev` + `cua-driver` skill | manual checks below      |

## Implementation rules relevant to this plan

- Strict TS, no `any` or unsafe casts. React 19: ref as a prop, one component
  per file, about 150 lines and 6 props at most, hooks own logic, no derived
  state synced through effects, effects only for external systems (DOM scroll,
  `ResizeObserver`).
- No code comments unless the why is non-obvious; one short line then.
- Keep `LauncherFooter`'s props unchanged so its 14 callers do not change
  their call sites for the footer itself.
- Brand: warm, quiet, dark-first. Reuse the `--panel*` tokens and the amber
  `--row-active` selection. No new hues, no gradients, no sparkle icons.
- Accessibility is not optional: WCAG AA contrast for capsule text over any
  row that can scroll beneath it, visible focus rings, an opaque capsule under
  `prefers-reduced-transparency`, a solid capsule border under
  `prefers-contrast: more`, and a reduced-motion path for every animation.
- Animate only `transform`, `opacity` and `filter`. Tokens come from
  `lib/motion.ts` through `useMotionPreset()`.
- Colocated tests: components and hooks in `*.browser.test.tsx`, pure logic in
  `*.test.ts`; 80% line coverage is a CI gate.

## Decisions taken in this plan (change before building if you disagree)

- **Steady height applies while a query is typed, not always.** When the root
  or History input goes from empty to non-empty, the body's current height
  becomes its floor until the input is empty again. The panel can still grow.
  Raycast uses one fixed height for everything; that was rejected because the
  ask answer's morph depends on the panel being content-sized.
- **The footer floats in every view, not only in lists.** Non-scrolling views
  reserve the same clearance, so nothing is ever hidden under a capsule.
- **Rows become contiguous** (40pt pitch instead of 44). Section spacing moves
  to the section header.
- **Panel radius 18.** Rows have a 10pt radius at an 8pt inset, so 18 makes the
  corners concentric.

## UI and motion (mandatory)

| Moment               | Trigger                         | What moves                                                                              | Token                 | Reduced motion |
| -------------------- | ------------------------------- | --------------------------------------------------------------------------------------- | --------------------- | -------------- |
| Action label changes | Selection moves to another kind | Existing `SwapText` in the right capsule; the capsule's width follows with `layout`.    | `SPRING_SNAPPY`       | Instant width  |
| Right capsule in/out | A view has or loses any action  | Capsule fades and scales from 0.96.                                                     | `FADE_IN`, `FADE_OUT` | Opacity only   |
| Edge fade            | List scrolled away from an edge | A mask over the top 12pt and the bottom footer zone fades in; it is absent at the edge. | `FADE_OUT` duration   | Instant        |
| Typing at root       | Query empty → non-empty         | Nothing. The body keeps its height; rows change inside it.                              | —                     | —              |
| Query cleared        | Esc or delete to empty          | The floor is released and the panel settles through the existing layout morph.          | `SPRING_SOFT`         | Instant        |
| Actions menu         | `⌘K`                            | Existing scale-from-row; it now covers the right capsule.                               | `SPRING_SNAPPY`       | Opacity only   |

Designed states to snapshot: footer with status and action, footer with status
only (no right capsule), footer with five hints (ask view), a scrolled list
with both fades, reduced transparency, increased contrast.

## Scope

**In scope**

- `apps/app/src/mainview/index.css` — a capsule material utility, a body
  clearance token, the scroll-fade mask.
- `components/launcher/launcher-footer.tsx` (+ browser test, snapshots).
- `components/launcher/launcher-scroll-area.tsx`, a new
  `components/launcher/use-scroll-edges.ts` (+ browser tests).
- `components/launcher/launcher-list.tsx`, `launcher-surface.tsx`.
- A new `components/launcher/use-steady-height.ts` (+ browser test), used by
  `launcher/views/root-view.tsx` and `history/history-view.tsx`.
- A new `components/launcher/footer-location.tsx` (+ browser test), used by
  `history/history-status.tsx`, `lookup/lookup-view.tsx` and
  `launcher/views/board-picker-view.tsx`.
- The 14 view-body lines listed under Current state,
  `components/launcher/schema/table-panes.tsx` (clearance only), and
  `components/launcher/actions/actions-menu.tsx` (position and z-index only).
- Snapshot files next to any touched test; `apps/app/e2e/*.spec.ts` only where
  a selector breaks.
- `CLAUDE.md` — the Launcher UI and Styling paragraphs.
- `.factory/plans/README.md` (status only).

**Out of scope**

- `LauncherFooter`'s props and every caller's `status`, `actionLabel` and
  `hints` values.
- The ask view's height morph, `panel-height.ts` limits, `use-window-height-sync.ts`
  and anything under `src/bun/`.
- Board windows (`components/board/`), which have their own chrome.
- Row content, ranking, sections and action menus' behaviour: plans 022 and 023.

## Git workflow

- Branch `feat/launcher-021-one-surface`. Commit only if authorized; do not
  push or open a PR unless told to.

## Steps

### Step 1: Capsule footer

Rebuild `LauncherFooter` as an overlay with the same props. The `<footer>`
becomes `absolute inset-x-2 bottom-2` with `pointer-events-none`, above the
body (`z-20`). Inside it, two capsules with `pointer-events-auto`:

- Left: `status`. About 32pt tall, fully rounded, capsule material.
- Right: primary action (`SwapText` label + `KeyCombo`) followed by the hints,
  separated by the existing `border-l border-panel-border`. Render no right
  capsule at all when `actionLabel === null` and `hints` is empty.

Add `@utility capsule-material` to `index.css`: `--panel-raised` background,
1px `--panel-border`, the inset `--panel-highlight`, a small shadow, and a
backdrop blur so rows passing beneath do not fight the label. Fall back to
`--panel-solid` with no blur under `prefers-reduced-transparency: reduce`.

**Evidence**: `launcher-footer.browser.test.tsx` covers both capsules, the
status-only case, a disabled hint, and that `footer` is still found by
`getByRole("contentinfo")`.

### Step 2: Body clearance and no hairlines

Define one clearance (capsule height + its bottom inset + 8pt, about 48pt) as a
CSS variable and a `@utility launcher-body` that applies it as
`padding-bottom`. On each of the 14 view-body lines, replace
`border-t border-panel-border` with `launcher-body`. Where the body wraps a
`LauncherScrollArea` (root, the `#` table panes, history, board picker, watches,
lookup), put the
clearance on the scroll area's content so the last row can scroll clear of the
capsules, and do not double it on the wrapper.

Move `ActionsMenu` to `right-2 bottom-2 z-30` in the launcher so it covers the
right capsule, as its anchor. `ActionsMenu` is also rendered by
`components/board/board-tile.tsx` inside board windows, which have no footer:
that caller's placement must not change. If the position has to differ, let
the caller choose it; do not add a boolean prop.

**Evidence**: `rg -n "border-t border-panel-border" apps/app/src/mainview/components/launcher/views apps/app/src/mainview/components/ask/ask-view.tsx apps/app/src/mainview/components/history/history-view.tsx`
returns nothing; in every view the last focusable control is fully visible
above the capsules.

### Step 3: Scroll edge fades

Add `useScrollEdges(ref)`: it listens to `scroll` and a `ResizeObserver` and
returns `{ atStart: boolean; atEnd: boolean }`. `LauncherScrollArea` sets
`data-fade-start` / `data-fade-end` from it and applies a `mask-image` linear
gradient: 12pt at the top when not at the start, the clearance height at the
bottom when not at the end. A list that does not overflow has no mask.

**Evidence**: browser test with an overflowing list asserts the attributes at
the top, middle and end; a non-overflowing list has neither.

### Step 4: Row geometry and radius

Remove `gap-1` from `LauncherListbox`; give `LauncherSection` headers the
spacing that separated sections (first section keeps today's top padding).
Set the panel `borderRadius` to 18 in `launcher-surface.tsx`. Check
`history/history-states.tsx` skeleton rows still line up with real rows.

### Step 5: Steady height while typing

Add `useSteadyHeight(query)` returning `{ bodyRef, minHeight, onInput }`.
`onInput(next)` is called from the input's change handler: when the previous
query was empty and `next` is not, it stores `bodyRef.current.offsetHeight`.
`minHeight` is that stored value while `query !== ""` and `0` otherwise, so an
Esc-clear from `LauncherStackView` releases it without an effect. Use it in
`root-view.tsx` (combine with `listMinHeight` through `Math.max`) and in
`history-view.tsx` (combine with the menu's min height).

**Evidence**: browser test types into a root with eight rows, narrows to one,
and asserts the body's `offsetHeight` did not shrink; clearing the query
restores content height.

### Step 6: Footer location for views without a header

Views that start with an input have no title. Add `FooterLocation`
(`{ icon: LucideIcon; label: string }`, `type-meta`) and show it as the resting
status in History ("History"), Lookup ("Look up") and the board picker ("Add
to Board"). Transient messages keep replacing it as they do now.

### Step 7: Docs and verification

Update `CLAUDE.md`: the footer is floating capsules, bodies use `launcher-body`,
`LauncherScrollArea` owns edge fades, the root and History hold their height
while a query is typed. Then run the full command table and the desktop checks.

## Test plan

- New: `launcher-footer.browser.test.tsx` (extend or create),
  `use-scroll-edges.browser.test.tsx`, `use-steady-height.browser.test.tsx`,
  `footer-location.browser.test.tsx`. Model hook tests on
  `components/launcher/use-row-in-view.browser.test.tsx` and component tests on
  `components/launcher/stack-view-frame.browser.test.tsx`.
- Update snapshots for every view whose body class or footer markup changed and
  read each diff: only the class swap and the footer structure should differ.
- e2e: run all specs; fix selectors that relied on footer DOM order.
- Desktop (`cua-driver`): summon, type to narrow the root to one row and back,
  open History with 20+ entries and scroll, open `⌘K` on a widget, run an ask.

## Done criteria

- [ ] `bun run check-types`, `bun run check`, `bun run --cwd apps/app test` and
      `bun run --cwd apps/app e2e` pass; coverage stays at or above 80%.
- [ ] No view body draws a line under the input or above the footer; the
      `rg` command in Step 2 returns nothing.
- [ ] In every one of the 14 views the footer is two capsules (or one), and no
      content is hidden beneath them at rest or at the end of a scroll.
- [ ] Desktop: typing at the root from eight rows down to one does not move the
      footer; clearing the query lets the panel settle.
- [ ] Desktop: the ask flow still morphs from question to answer exactly as
      before (compare a 0.25× recording, `?slowmo=4`, against `main`).
- [ ] Capsule text passes AA contrast over a selected row and over an
      unselected row, in dark and light themes.
- [ ] Reduce Motion, Reduce Transparency and Increase Contrast verified.
- [ ] Every row of the motion table has a browser test for its normal and
      reduced branch.
- [ ] `git status` shows changes only in the in-scope files.

## STOP conditions

- The nested backdrop blur on the capsules drops frames in a Safari Web
  Inspector Timelines capture while the list scrolls. Report the measurement
  and propose the solid capsule; do not ship a janky blur.
- The floating footer cannot be made to travel with its view during push and
  pop without changing `StackViewFrame` or `LauncherSurface` layout behaviour.
- Holding the root height changes the native window resize sequence in a way
  that clips the panel (`use-window-height-sync.ts` would need to change).
- The ask morph regresses and the cause is the clearance or the radius.

## Maintenance notes

- Any new launcher view must use `launcher-body` on its body and render
  `LauncherFooter`; a view that forgets the clearance hides its last control.
- Plan 022 adds rows and sections to the root; plan 023 changes `ActionsMenu`
  and the History rows. Both assume this plan's footer and clearance.
- Reviewer focus: contrast of the capsules over scrolling content, and the
  14 view snapshots.
- Deferred: a fixed panel height for all list views (Raycast's model). Revisit
  if the steady-height floor still feels restless.
