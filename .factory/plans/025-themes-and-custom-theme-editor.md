# Plan 025: Pick a theme, or build your own token by token

> **Executor instructions**: Deliver the stated outcome within scope. Adapt routine
> implementation details to current code, preserve the listed contracts, and run
> the relevant acceptance checks. Fix task-caused failures and recheck affected
> behavior. Escalate only the material conditions below. Update the plan's status
> in `.factory/plans/README.md` unless the coordinator owns that index.
>
> **Drift check**: Compare
> `git diff --stat aaa8938 -- apps/app/src/mainview/index.css apps/app/src/mainview/components/theme-provider.tsx apps/app/src/mainview/components/app-providers.tsx apps/app/src/mainview/components/launcher apps/app/src/mainview/lib/ipc.ts apps/app/src/mainview/lib/browser-ipc-stub.ts apps/app/src/bun/rpc.ts packages/rpc/src packages/core/src`
> and `git status --short` with the recorded current state. Plan 024 is expected
> drift in `index.css`. Reconcile routine drift; pause dependent work if drift
> invalidates scope, a protected contract, or an unresolved product or
> permission decision.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: `.factory/plans/024-neutral-gray-palette-red-mark.md`
- **Category**: direction
- **Planned at**: commit `aaa8938`, 2026-11-22, clean working tree

## Why this matters

Conch has one look and a System/Dark/Light switch. The owner wants themes:
ship more than one, and let people make their own. After this plan a user
opens Themes from the launcher, arrows through themes that preview live, and
picks one for dark and one for light. They can duplicate any theme and edit
every color token by hand, with a live preview and contrast notes, then export
it as a file or import someone else's. The warm amber look that plan 024
replaces comes back as a built-in theme, so nobody loses it.

## Owner decisions (2026-11-22)

Settled. Do not reopen them.

1. **Custom themes edit every token.** The editor shows each color token, not
   a few seed colors with derived values. The owner chose this knowing it is
   slower and can produce low-contrast themes; the editor warns, and blocks
   only themes that would make the app unusable.
2. **Four built-in themes**: Conch Dark and Conch Light (plan 024's neutral
   gray), Amber Dark and Amber Light (the pre-024 palette).
3. Themes are picked per appearance, as in Raycast: one theme for dark, one
   for light, and a System/Dark/Light mode that chooses between them.

## Current state

Read plan 024 first; this plan assumes it has landed. Facts below are at
`aaa8938` unless marked "after 024".

- **Tokens** live in `apps/app/src/mainview/index.css` as CSS custom
  properties in `:root, .light` and `.dark` blocks, mapped to Tailwind colors
  in `@theme inline`. After 024 the color tokens are the 48 listed under
  "Theme tokens" below, plus three aliases declared once
  (`--card-foreground`, `--popover`, `--popover-foreground`) and a composed
  `--shadow-panel`. The `prefers-contrast: more` block overrides `--panel`,
  `--panel-muted`, `--muted-foreground` and `--panel-border` on
  `:root, .light, .dark`.
- **Theme switching** is `next-themes`:
  - `components/theme-provider.tsx` re-exports `ThemeProvider` and `useTheme`.
  - `components/app-providers.tsx` mounts it with `attribute="class"`,
    `defaultTheme="dark"`, `storageKey="vite-ui-theme"` (localStorage).
  - `components/launcher/views/settings/theme-control.tsx` is a
    `SegmentedControl` (System/Dark/Light) on `useTheme()`; it is the only
    `useTheme` consumer. `settings-view.tsx` renders it in the "Launcher"
    group under the label "Appearance".
  - `settings-view.browser.test.tsx:263` ("switches theme with clicks and
    arrow keys") asserts the radio state and
    `document.documentElement.classList.contains("light")`.
- **CSS entry**: `routes/__root.tsx` imports `@/index.css` and wraps the
  outlet in `AppProviders`. `main.tsx` creates the router and renders; nothing
  runs before it except `document.documentElement.dataset.platform`.
- **Windows**: the launcher is one transparent `BrowserWindow`
  (`src/bun/launcher.ts`); boards and mini-apps are separate titled windows
  (`src/bun/panel-windows.ts`) loading `#/board/:id` and `#/app/:id`. Each has
  its own renderer and its own RPC built by `createAppRpcs` in
  `src/bun/rpc.ts`. Bun reaches every window through broadcast helpers, for
  example `broadcastBoardChanged` (`rpc.ts:285`). Requests that only the
  launcher may call are grouped in `launcherOnly` (`rpc.ts:878`).
- **Settings storage patterns**:
  - Plain app settings live in `~/.config/conch/config.json` through
    `getConfig`/`saveConfig` (`packages/core/src/config.ts`, `AppConfig`),
    read and written by small validated helpers in
    `apps/app/src/bun/launcher-config.ts` (see `writeClipboardLookups`).
  - User records live in encrypted files through `createRecordStore`
    (`packages/core/src/records.ts`): locking, atomic writes, quarantine of
    unreadable files, and records the parser rejects are kept. `boards.ts`
    (`createBoardStore`) is the smallest exemplar; paths are in
    `packages/core/src/paths.ts` (`boardsPath()` and friends).
  - Contracts and pure logic shared by bun and the renderer live in
    `packages/rpc/src` (`board.ts` holds the `Board` schema and pure tile
    ops). The request/message map is `packages/rpc/src/schema.ts`
    (`getClipboardLookups` at line 230, `boardChanged` at line 410).
  - Renderer wrappers are in `apps/app/src/mainview/lib/ipc.ts`
    (`getClipboardLookups` at line 701, message subscription at line 518);
    the browser-mode emulator is `lib/browser-ipc-stub.ts`, with larger
    features split out (`lib/browser-bundle-stub.ts`).
- **File dialogs and saving files**: bundles import through
  `Utils.openFileDialog` wrapped in `launcher.runModal(...)` so the launcher
  does not dismiss on blur (`rpc.ts:552-563`), read with a size cap
  (`readTextUpTo`), and export into Downloads through
  `apps/app/src/bun/downloads.ts` (`SAVE_EXTENSIONS = ["csv", "conch.json"]`).
- **Launcher views**: `components/launcher/use-launcher-stack.ts` defines the
  `LauncherView` union; `panel-height.ts` lists the tall "content" views
  (680 pt) in `CONTENT_VIEWS`, every other view is a 476 pt list. Root
  commands are `components/launcher/root-commands.ts` (`rootCommands`, each a
  `LauncherCommand` with `title`, `keywords`, `run`). List views use
  `LauncherScrollArea`, `LauncherFooter`, the `launcher-body` utility, and
  `ActionsMenu` (`⌘K`, `launcher/actions/`); `views/use-catalog-menu.ts` is the
  exemplar for a row menu with armed two-press delete (`⌃X`).
- **Blur hides the launcher.** A native panel that takes focus (a system
  color picker, for example) dismisses it unless bun opened it inside
  `runModal`. `<input type="color">` opens the macOS color panel from the
  webview, outside `runModal`, so it cannot be used.
- **Contrast audit**: after 024, `apps/app/scripts/audit-contrast.ts` parses
  `index.css`, composites translucent tokens over reference wallpapers
  (`#1a1a1c` dark, `#f0f0f1` light) in gamma-encoded sRGB, and writes
  `apps/app/docs/color-tokens.md`. It holds the only `oklch` → sRGB code in
  the repo.
- **The Amber palette** is the `:root, .light` (lines 7–78) and `.dark`
  (lines 80–141) blocks of
  `git show aaa8938:apps/app/src/mainview/index.css`. Identifying values:
  dark `--primary: oklch(0.9247 0.0524 66.1732)`,
  `--panel: oklch(0.185 0.008 45 / 0.88)`,
  `--row-active: oklch(0.82 0.08 66 / 0.2)`; light
  `--primary: oklch(0.4341 0.0392 41.9938)`.
- `next-themes` is a dependency of `apps/app` (`package.json:47`). `zod` is in
  the catalog. There is no color-picker dependency.

## Commands you will need

| Purpose             | Command                                                              | Expected on success                                   |
| ------------------- | -------------------------------------------------------------------- | ----------------------------------------------------- |
| Install             | `bun install`                                                        | exit 0                                                |
| Typecheck           | `bun run check-types`                                                | exit 0                                                |
| Lint + format       | `bun run check` (`bun run fix` to auto-fix)                          | exit 0                                                |
| Contract tests      | `bun run --cwd packages/rpc test`                                    | all pass                                              |
| Core tests          | `bun run --cwd packages/core test`                                   | all pass                                              |
| App tests           | `bun run --cwd apps/app test`                                        | all pass, coverage ≥ 80% lines                        |
| Scoped browser test | `bun run --cwd apps/app test:browser src/mainview/components/themes` | all pass                                              |
| E2E                 | `bun run --cwd apps/app e2e`                                         | all pass (see 024 for the known pre-existing failure) |
| Contrast audit      | `bun run apps/app/scripts/audit-contrast.ts`                         | exit 0                                                |
| Browser build       | `bun run dev:web` → http://localhost:3001                            | launcher renders                                      |
| Desktop build       | `bun run --cwd apps/app desktop:dev`                                 | app launches                                          |

## Design

### Theme tokens (the contract)

A theme is a name, an appearance and a value for each of these 48 tokens.
The token name is the CSS custom property without `--`.

| Group       | Tokens                                                                                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Surfaces    | `background`, `card`, `muted`, `secondary`, `accent`, `input`, `border`, `panel`, `panel-solid`, `panel-raised`, `panel-border`, `panel-highlight`, `scrim`, `shadow` |
| Text        | `foreground`, `muted-foreground`, `secondary-foreground`, `accent-foreground`, `panel-muted`                                                                          |
| Controls    | `primary`, `primary-foreground`, `ring`, `row-hover`, `row-active`, `kbd`, `control-thumb`                                                                            |
| Brand       | `brand`                                                                                                                                                               |
| Status      | `destructive`, `destructive-foreground`, `warning`, `warning-foreground`, `success`, `success-foreground`, `danger-ink`, `warning-ink`, `success-ink`                 |
| Charts      | `chart-1` … `chart-6`                                                                                                                                                 |
| Connections | `conn-honey`, `conn-denim`, `conn-moss`, `conn-plum`, `conn-clay`, `conn-stone`                                                                                       |

Not themeable: radius, fonts, tracking, spacing, motion, and the aliases
(`card-foreground`, `popover`, `popover-foreground`, `shadow-panel`).

`packages/rpc/src/theme.ts` (new, a protected contract like `board.ts`):

```ts
export const THEME_VERSION = 1;
export type ThemeAppearance = "dark" | "light";
export type ThemeMode = "system" | "dark" | "light";

export interface Theme {
  id: string;
  version: 1;
  name: string;
  appearance: ThemeAppearance;
  tokens: Record<ThemeTokenName, string>;
}
export interface ThemeSettings {
  mode: ThemeMode;
  darkThemeId: string;
  lightThemeId: string;
}
export interface ThemeState {
  settings: ThemeSettings;
  custom: Theme[];
}
```

- `THEME_TOKEN_GROUPS`: the table above as data (`id`, `label`, and per token
  `name`, `label`, `alpha: boolean`); `ThemeTokenName` derives from it. Token
  labels are plain words ("Selected row", "Panel border", "Chart 1").
- **Color grammar.** A token value is exactly one of `#rrggbb`, `#rrggbbaa`
  (hex, either case), or `oklch(L C H)` / `oklch(L C H / A)` with plain
  decimal numbers (L may end in `%`, H may end in `deg`). Anything else is
  rejected: no `var()`, `url()`, `color-mix()`, named colors or whitespace
  tricks. One strict regex per form. Built-ins are written in `oklch`; the
  editor writes hex.
- `themeSchema` (zod, `.strict()`): `name` trimmed, 1–60 characters; `tokens`
  must contain every token and nothing else; `version` literal 1.
  `parseStoredTheme(raw): Theme | null` for the record store.
- `BUILTIN_THEMES: readonly Theme[]` with ids `conch-dark`, `conch-light`,
  `amber-dark`, `amber-light`; `DEFAULT_THEME_SETTINGS =
{ mode: "dark", darkThemeId: "conch-dark", lightThemeId: "conch-light" }`;
  `isBuiltinThemeId(id)`.
  - Conch values: the two columns of plan 024 Step 1, plus the unchanged
    status and `conn-*` values from `index.css`.
  - Amber values: from `git show aaa8938:apps/app/src/mainview/index.css`.
    For tokens that did not exist then: `brand` = that scheme's old `primary`;
    `scrim` = `oklch(0.18 0.007 34 / 0.6)` dark and
    `oklch(0.25 0.02 50 / 0.35)` light; `shadow` =
    `oklch(0 0 0 / 0.6)` dark and `oklch(0.25 0.02 50 / 0.28)` light. Drop
    the `sidebar*` tokens.
- `resolveTheme(state, systemAppearance): Theme` (pure): picks the appearance
  from `mode`, finds the theme by id among built-ins and `custom`, and falls
  back to the default built-in for that appearance when the id is missing or
  its appearance does not match.

`packages/rpc/src/theme-color.ts` (new, pure): `parseThemeColor(value)` →
`{ r, g, b, a } | null` in gamma-encoded sRGB 0–1 (move the `oklch` math out
of `audit-contrast.ts`), `toHex(color)` (`#rrggbb`, or `#rrggbbaa` when
`a < 1`), `compositeOver(top, base)`, `contrastRatio(a, b)`.

`packages/rpc/src/theme-contrast.ts` (new, pure): `CONTRAST_PAIRS` (the pair
table from plan 024 Step 6, each with `min` 4.5 or 3 and the surface it is
composited over) and `themeContrastReport(theme)` → one entry per pair with
`ratio` and `level`:

- `ok`: ratio ≥ `min`.
- `warn`: below `min`. Shown in the editor; never blocks.
- `block`: one of three core pairs below 3:1: `foreground` on `background`,
  `foreground` on `panel` (over the reference wallpaper), and
  `primary-foreground` on `primary`. A theme with a `block` entry cannot be
  saved or applied, so a user can always read the launcher well enough to
  switch away.

`themeProblems(theme)` returns the `block` entries. Built-in themes must have
no `warn` and no `block`.

### Storage and the bun service

- `packages/core/src/paths.ts`: `themesPath()` → `themes.enc`.
- `packages/core/src/themes.ts`: `createThemeStore(parse)` over
  `createRecordStore(themesPath, parse)`, shaped like `boards.ts`.
- `packages/core/src/config.ts`: `AppConfig.theme?: { mode: string;
darkThemeId: string; lightThemeId: string }`. Core does not import
  `@conch/rpc`; bun validates the shape with zod.
- `apps/app/src/bun/theme-service.ts` (new, with injected deps so it is
  testable: store, config read/write, `pickFile`, `readFile`, `saveFile`,
  `newId`, `broadcast`):

  | Method                  | Behavior                                                                                                                                                                                                                           |
  | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `getState()`            | Settings from config (default when absent or invalid) and custom themes. An id that no longer resolves is replaced by the default for that appearance and written back.                                                            |
  | `setSettings(settings)` | Validates; each id must exist and match its appearance. Saves to config, broadcasts.                                                                                                                                               |
  | `saveTheme(draft)`      | Validates with `themeSchema` and `themeProblems`. No `id` → new id `theme_<uuid>`; a built-in id is refused. At most 50 custom themes. Saves, broadcasts, returns the theme.                                                       |
  | `deleteTheme(id)`       | Custom only. If it was selected, that appearance falls back to its default. Broadcasts.                                                                                                                                            |
  | `exportTheme(id)`       | Writes `<slug>.conch-theme.json` (the `Theme` without `id`) to Downloads through `downloads.ts`; add `"conch-theme.json"` to `SAVE_EXTENSIONS`. Built-ins can be exported.                                                         |
  | `importTheme()`         | `pickFile` inside `launcher.runModal`, read at most 64 KB, `JSON.parse`, validate exactly like `saveTheme`, give it a new id, and if the name is taken append " 2", " 3"…. Returns the theme or a typed "not a Conch theme" error. |

  Every change sends the message `themeChanged: ThemeState` to the launcher
  and every open board and app window.

- `packages/rpc/src/schema.ts`: requests `getThemeState`, `setThemeSettings`,
  `saveTheme`, `deleteTheme`, `exportTheme`, `importTheme`; message
  `themeChanged`. In `rpc.ts`, `getThemeState` goes in the common handlers;
  the five mutating requests go in `launcherOnly`.

### Applying a theme in the renderer

- `index.css`: delete the per-scheme color blocks. `:root` keeps non-color
  tokens, the three aliases and `--shadow-panel`. `@theme inline` is
  unchanged. Because theme values are now inline custom properties on
  `<html>`, the `prefers-contrast: more` overrides must win over inline
  styles: declare them on `:root` with `!important`
  (`--panel: var(--panel-solid) !important;` and the three others).
- `lib/theme/apply-theme.ts`: `applyTheme(theme, root = document.documentElement)`
  toggles the `dark`/`light` class, sets `root.style.colorScheme`, and calls
  `root.style.setProperty("--" + name, value)` for each token. Never build a
  CSS string from theme values.
- `lib/theme/theme-store.ts`: one module-level store read with
  `useSyncExternalStore`. It holds `ThemeState`, the system appearance (a
  `matchMedia("(prefers-color-scheme: dark)")` listener) and an optional
  `preview: Theme | null`. The applied theme is `preview ?? resolveTheme(...)`;
  every change calls `applyTheme` and writes the applied theme to
  `localStorage["conch-theme"]` (not for previews; wrap in try/catch).
  - `initTheme()` is called in `main.tsx` before `root.render`: apply the
    cached theme if it parses with `themeSchema`, else Conch Dark, so the
    first paint is already themed in every window. Then fetch `getThemeState()`
    and subscribe to `themeChanged`.
  - One-time migration, launcher window only: if
    `localStorage["vite-ui-theme"]` is `system`, `dark` or `light`, send
    `setThemeSettings` with that mode and the current ids, then remove the key.
  - Exposed hooks: `useThemeState()`, `useAppliedTheme()`, and actions
    (`setMode`, `selectTheme(id)`, `setPreview`).
- Remove `next-themes` (`package.json`, `theme-provider.tsx`, the provider in
  `app-providers.tsx`; `MotionConfig` stays).
- `src/mainview/test/setup-browser.ts`: call `applyTheme` with Conch Dark so
  component tests render with colors.

### UI

- **Settings → Launcher**: the Appearance row keeps the System/Dark/Light
  `SegmentedControl` (now `setMode`). Add a "Theme" row under it: the applied
  theme's name and an Open button that pushes the `themes` view. Match the
  existing Open buttons in `settings-view.tsx`.
- **Root command** "Themes" (keywords: theme, appearance, color, dark, light)
  pushes the same view.
- **`themes` view** (list height). `LauncherView` variant `{ kind: "themes" }`.
  - Two sections, "Dark" and "Light". Each row: a swatch strip (`background`,
    `panel-solid`, `foreground`, `primary`, `brand`, `chart-1`, `chart-2`,
    `chart-3`), the name, and a trailing "Built-in" or "Custom". The theme in
    use for each appearance shows a check.
  - Moving the selection previews that theme in this window (`setPreview`).
    Leaving the view clears the preview.
  - `↵` Use Theme: sets it for its appearance, and if the mode is not System
    and differs from the theme's appearance, switches the mode to match so
    the user sees what they picked. In System mode it only sets the id; when
    that appearance is not the current one the footer status says, for
    example, "Used when your Mac is in light mode".
  - `⌘K` menu, led by Use Theme: Edit (custom only), Duplicate, Export,
    Delete (custom only, `⌃X`, armed two-press like `use-catalog-menu.ts`).
    View-level actions: New Theme (duplicates the selected theme into the
    editor) and Import Theme. Pick shortcuts that do not collide with the
    launcher's existing ones; reuse `⌘N`/`⌘E` only if those are free in list
    views.
  - Filtering by typing uses the same ranking as other list views.
- **`theme-edit` view** (content height: add it to `CONTENT_VIEWS`).
  `LauncherView` variant
  `{ kind: "theme-edit"; source: { kind: "new"; from: Theme } | { kind: "existing"; theme: Theme } }`.
  - Header: name field. A Dark/Light control sets the appearance for a new
    theme only.
  - A fixed preview strip above the list (`ThemePreview`): a normal and a
    selected row, a keycap, a primary button, a checkbox, a focus ring, danger
    and success text, the brand caret and progress line, six chart bars, the
    six connection dots, and a footer capsule. It shows the tokens the
    editor's own chrome does not exercise.
  - One row per token, grouped as in the table: label, swatch, hex field,
    and an opacity field (0–100) for tokens whose `alpha` is true. The swatch
    opens a popover (`ui/popover.tsx`) with a 2D picker. Use `react-colorful`
    (`HexAlphaColorPicker` / `HexColorPicker`, about 3 kB, no dependencies);
    a native `<input type="color">` is not allowed (see "Blur hides the
    launcher"). The hex field accepts paste of `#rgb`, `#rrggbb`, `#rrggbbaa`
    and normalizes on blur; an invalid value shows an inline error and is not
    applied.
  - Every valid edit updates the draft and `setPreview(draft)`, so the whole
    launcher re-themes as you type. Boards change only on save.
  - Contrast notes: a row whose token is in a failing pair shows the ratio
    and the pair ("3.2:1 on Panel, aim for 4.5"). The footer status shows the
    count ("2 contrast notes") or "Readable". A `block` entry disables Save
    and says why.
  - `⌘S` saves (`saveTheme`), pops to the list with the theme selected, and
    leaves it un-applied until the user presses `↵` on it, unless the edited
    theme is the one in use, in which case every window updates.
  - `Esc` with unsaved changes arms a discard ("Press Esc again to discard");
    a second `Esc` pops and clears the preview.
  - Draft state is one reducer (`use-theme-draft.ts`): set token, set name,
    set appearance. Dirty is derived by comparing to the source.
- **Files** (new folder `apps/app/src/mainview/components/themes/`):
  `themes-view.tsx`, `theme-row.tsx`, `theme-swatches.tsx`,
  `use-themes-menu.ts`, `theme-edit-view.tsx`, `theme-token-row.tsx`,
  `color-field.tsx`, `theme-preview.tsx`, `contrast-note.tsx`,
  `use-theme-draft.ts`, each with its test. Keep components under ~150 lines
  and ~6 props; split when a second responsibility appears.
- **Browser mode**: `lib/browser-theme-stub.ts` emulates the six requests
  with state in localStorage and emits `themeChanged`; `exportTheme` returns a
  file name without writing; `importTheme` reads
  `globalThis.__conchThemeImport` (a JSON string an e2e test sets) and fails
  with the typed error when it is absent. Wire it in `browser-ipc-stub.ts`.

## Implementation rules relevant to this plan

- TypeScript strict, no `any`, no unsafe casts. Validate at the edges (RPC
  input, file import, localStorage cache); trust `Theme` inside.
- Bun is the only writer. The renderer never writes theme files and never
  trusts a theme it did not get from bun or from `BUILTIN_THEMES`, except the
  localStorage cache, which it re-validates with `themeSchema`.
- Theme values reach the DOM only through `style.setProperty` after passing
  the color grammar. Theme names render as text.
- `packages/rpc/src/theme*.ts` must not import `@conch/core`: the renderer
  imports them, and core's WASM top-level await must not load there.
- State lives at the lowest component that needs it; derive in render; no
  derived state synced through `useEffect`. Hotkeys live in a `useXxxHotkeys`
  hook. One component per file, file name matches the export.
- New views use `launcher-body`, `LauncherScrollArea` and `LauncherFooter`,
  like every view since plan 021.
- Motion goes through `lib/motion.ts` tokens (`useMotionPreset`), with a
  reduced-motion path. Applying a theme does not animate.
- Focus rings stay visible on every control in the editor; the picker is
  reachable and usable by keyboard (`react-colorful` supports arrow keys).
- Copy is plain and short: "Use Theme", "New Theme", "Import Theme",
  "Export", "Delete", "Readable", "2 contrast notes". No exclamation marks.
- No code comments unless the why is non-obvious, one short line.

## Scope

**In scope**

- `packages/rpc/src/theme.ts`, `theme-color.ts`, `theme-contrast.ts` and
  tests (create); `packages/rpc/src/index.ts`, `schema.ts`
- `packages/core/src/themes.ts` and test (create); `paths.ts`, `config.ts`,
  `index.ts`
- `apps/app/src/bun/theme-service.ts` and test (create); `rpc.ts`,
  `downloads.ts` (one extension), `launcher-config.ts` if the config helper
  lives there
- `apps/app/src/mainview/index.css`, `main.tsx`
- `apps/app/src/mainview/lib/theme/*` (create), `lib/ipc.ts`,
  `lib/browser-ipc-stub.ts`, `lib/browser-theme-stub.ts` (create)
- `apps/app/src/mainview/components/themes/*` (create)
- `components/theme-provider.tsx` (delete), `components/app-providers.tsx`
- `components/launcher/use-launcher-stack.ts`, `panel-height.ts`,
  `root-commands.ts`, the launcher's view switch and handlers that register a
  new view, `views/settings-view.tsx`, `views/settings/theme-control.tsx`,
  `views/settings/theme-row.tsx` (create)
- `apps/app/src/mainview/test/setup-browser.ts`
- `apps/app/scripts/audit-contrast.ts`, `apps/app/docs/color-tokens.md`
- `apps/app/e2e/theme-flow.spec.ts` (create)
- `apps/app/package.json` (remove `next-themes`, add `react-colorful`)
- `CLAUDE.md` (Theming and Styling bullets, a "Themes" architecture bullet),
  `DESIGN.md` (where the token source is described)
- `.factory/plans/README.md` (status)

**Out of scope**

- Seed-based or AI-generated themes, per-connection themes, a theme gallery
  or `conch://` theme links.
- Themes inside export bundles (plan 015) or the MCP server.
- Theming fonts, radius, density or motion.
- The native title bar of board and app windows; it follows macOS, not the
  Conch theme.
- `apps/video/**` and the tray icons.
- Renaming or removing any of the 48 tokens. Adding a token later needs a
  `THEME_VERSION` bump and an upgrade in `parseStoredTheme`.

## Git workflow

- Work on a feature branch (`feat/025-themes`, or continue the operator's
  current branch). Never commit to `main`.
- Commit only if authorized; message style is a plain sentence, for example
  `Add themes and a custom theme editor (plan 025)`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: The contract and the color math

Create `theme.ts`, `theme-color.ts` and `theme-contrast.ts` in
`packages/rpc/src` as designed, export them from `index.ts`, and write their
tests. Fill `BUILTIN_THEMES` from plan 024's table and from
`git show aaa8938:apps/app/src/mainview/index.css` for Amber.

**Evidence**: `bun run --cwd packages/rpc test` passes, including "every
built-in has all 48 tokens", "every built-in passes every contrast pair" and
grammar rejection cases (`red`, `var(--x)`, `url(x)`, `#12`, `oklch(1 0 0);x`).
If an Amber pair fails at its original value, adjust that one token's
lightness by the smallest step that passes and note it in the test name.

### Step 2: Storage and the bun service

Add `themesPath`, `createThemeStore`, `AppConfig.theme`, then
`theme-service.ts` with its tests (fake store and config, as
`board-service.test.ts` does). Add the six requests and the `themeChanged`
message to `schema.ts`; wire handlers in `rpc.ts` (`getThemeState` common,
mutations in `launcherOnly`) and a `broadcastThemeChanged` helper beside
`broadcastBoardChanged`.

**Evidence**: `bun run --cwd apps/app test:unit src/bun/theme-service.test.ts`
passes; `bun run check-types` exits 0.

### Step 3: Apply themes from data and drop `next-themes`

Create `lib/theme/apply-theme.ts` and `theme-store.ts`, add the `ipc.ts`
wrappers and `browser-theme-stub.ts`, call `initTheme()` in `main.tsx`,
remove the color blocks from `index.css` (keep aliases; add `!important` to
the contrast overrides), update `setup-browser.ts`, point `ThemeControl` at
the store, delete `theme-provider.tsx`, and remove the dependency
(`bun install`).

Point `audit-contrast.ts` at `BUILTIN_THEMES` and `themeContrastReport`
instead of parsing CSS, with one section per built-in in the generated doc.

**Evidence**: `bun run --cwd apps/app test` passes with the existing
"switches theme" test adapted to the store; `grep -rn "next-themes" apps packages --include="*.ts" --include="*.tsx" --include="package.json"`
returns nothing; in `dev:web` the launcher looks identical to the 024 build in
dark and light, and a reload does not flash another theme.

### Step 4: The Themes view

Add the `themes` view, the Settings row and the root command. Preview on
selection, `↵` to use, the `⌘K` menu, export, import, delete.

**Evidence**: browser tests for `themes-view` pass; in `dev:web`, arrowing to
Amber Dark recolors the launcher and `Esc` restores the theme in use.

### Step 5: The editor

Add `react-colorful`, then the `theme-edit` view with its draft reducer,
token rows, color field, preview strip and contrast notes.

**Evidence**: browser tests pass; in `dev:web`, duplicate Conch Dark, change
"Selected row", see the preview row change, save, and find the theme under
Dark marked Custom.

### Step 6: Every window, and the real app

Run `desktop:dev` and drive it with the `cua-driver` skill: open a board,
then from the launcher switch to Amber Dark and confirm the board window
recolors without a reload; open a new board window and confirm it paints in
Amber from its first frame; switch macOS appearance with mode System and
confirm both windows follow; open the color popover in the editor and confirm
the launcher does not dismiss; import and export a theme file through the
real dialogs.

If a new window flashes Conch Dark before turning Amber, localStorage is not
shared between windows: pass the applied theme id to new panel windows (for
example a `theme` query parameter read by `initTheme`) and keep the cache as
a second source.

### Step 7: Docs and index

- `CLAUDE.md`: replace the "Theming: `next-themes`…" bullet; update "Styling"
  to say colors come from theme data applied to `<html>`; add a "Themes"
  bullet in Architecture covering the contract files, `themes.enc`,
  `config.json` `theme`, the service, `themeChanged`, the store, the two
  views, the color grammar and the block rule.
- `DESIGN.md`: where it describes the token source.
- Regenerate `apps/app/docs/color-tokens.md`. Update the index row.

## Test plan

- `packages/rpc/src/theme.test.ts`: schema accepts a built-in; rejects a
  missing token, an extra token, a bad name, each bad color form;
  `resolveTheme` for the three modes, a missing id, and an id whose
  appearance does not match.
- `theme-color.test.ts`: `oklch` and hex parse to the same sRGB for known
  pairs (`oklch(0.66 0.22 29)` ≈ `#fc4738`), alpha round-trips through
  `toHex`, compositing, `contrastRatio(#fff, #000) = 21`.
- `theme-contrast.test.ts`: built-ins are all `ok`; a theme with
  `foreground` equal to `background` yields a `block`; a low-contrast
  `panel-muted` yields a `warn` only.
- `packages/core/src/themes.test.ts`: save, list, remove; an unknown record
  shape survives a write (model after `boards.test.ts`).
- `apps/app/src/bun/theme-service.test.ts`: defaults; dangling id repair;
  `setSettings` rejects an unknown id and a dark id in the light slot;
  `saveTheme` assigns an id, refuses a built-in id, refuses a `block` theme,
  enforces the 50 cap; `deleteTheme` of the theme in use falls back and
  broadcasts; `importTheme` rejects oversized, non-JSON and wrong-shape
  files, de-duplicates names; `exportTheme` omits the id.
- `lib/theme/theme-store.test.ts` and `apply-theme.browser.test.tsx`: class
  and custom properties are set; preview wins and clears; the cache is
  validated; the legacy `vite-ui-theme` key migrates once.
- `components/themes/*.browser.test.tsx`: list sections and check marks,
  preview on arrow keys, `↵` uses, menu actions, armed delete; editor:
  editing a hex field updates the preview and the dirty state, invalid hex
  shows an error, opacity field only on alpha tokens, a blocking theme
  disables Save, `⌘S` saves, two-press `Esc` discards; snapshot the list
  (populated) and the editor (clean, with a note, blocked).
- `settings-view.browser.test.tsx`: adapt the theme test; add "opens Themes".
- `apps/app/e2e/theme-flow.spec.ts`: open Themes from the root command, use
  Amber Dark and assert `html` has class `dark` and
  `getComputedStyle(html).getPropertyValue("--primary")` is the Amber value;
  create a theme, change a token, save, reload and assert it is still
  applied; import a theme through `__conchThemeImport`.

## Done criteria

- [ ] `bun run check-types` and `bun run check` exit 0
- [ ] `bun run --cwd packages/rpc test`, `bun run --cwd packages/core test`
      and `bun run --cwd apps/app test` exit 0; app line coverage ≥ 80%
- [ ] `bun run --cwd apps/app e2e` passes, including `theme-flow.spec.ts`
- [ ] `bun run apps/app/scripts/audit-contrast.ts` exits 0 for all four
      built-ins
- [ ] `grep -rn "next-themes" apps packages` (excluding `node_modules` and
      lockfiles) returns nothing
- [ ] `grep -nE "^\s*--(background|primary|panel):" apps/app/src/mainview/index.css`
      returns nothing: colors come from theme data
- [ ] Themes opens from Settings and from the root; four built-ins are
      listed; selection previews; `↵` applies; the choice survives a restart
- [ ] A custom theme can be created by duplicating, edited token by token
      with a live preview, saved, exported, imported, and deleted
- [ ] A theme whose text cannot be read cannot be saved, and the reason shows
- [ ] In the desktop app, an open board recolors when the theme changes, and
      a new window paints in the chosen theme from its first frame
- [ ] `CLAUDE.md` describes themes and no longer mentions `next-themes`
- [ ] `.factory/plans/README.md` row updated

## STOP conditions

- Plan 024 has not landed, or its token set differs from the 48 listed here.
  Reconcile the list with the owner before writing `BUILTIN_THEMES`; the
  token list is the stored contract.
- Opening the color popover dismisses the launcher in the desktop app and
  `react-colorful` cannot be made to work inside the panel. Report it with
  what you observed; do not ship hex-only editing without telling the owner.
- Inline custom properties on `<html>` do not reach a surface (for example a
  portal or a second document). Find the cause; do not duplicate the palette
  back into CSS as a workaround.
- A new dependency other than `react-colorful` seems necessary.
- The owner asks for seed-based editing or a gallery mid-build. That is a new
  plan.

## Maintenance notes

- Adding, renaming or removing a token is a contract change: bump
  `THEME_VERSION`, upgrade old records in `parseStoredTheme` (fill a new
  token from a sensible existing one), update `THEME_TOKEN_GROUPS`, the four
  built-ins and `CONTRAST_PAIRS` together.
- Reviewers should look at: the color grammar regexes (they are the only
  thing between an imported file and the DOM), `importTheme` limits, the
  `launcherOnly` placement of mutations, first-paint behavior in a new board
  window, and keyboard use of the editor.
- Deferred: themes in export bundles; recoloring `apps/video` from
  `BUILTIN_THEMES` instead of its own `theme.ts`; a tray or link escape hatch
  if users still manage to strand themselves despite the block rule.
