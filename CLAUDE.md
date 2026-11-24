# CLAUDE.md

Guidance for Claude Code working in this repo. Keep it short, keep it true.

## What this is

**Conch** (formerly oh-my-query) — desktop SQL/AI client. Turborepo monorepo. React 19 renderer (Vite) packaged as a native desktop app via Electrobun. The bun-side process in `apps/app/src/bun/` exposes RPC handlers consumed by the renderer through `electrobun/view`.

## Commands

```bash
bun install                              # deps
bun run dev                              # all apps (Turborepo)
bun run dev:web                          # renderer only — http://localhost:3001
bun run --cwd apps/app desktop:dev       # Electrobun dev (vite + watcher)
bun run --cwd apps/app desktop:build     # production desktop build
bun run check-types                      # tsc across workspaces
bun run check                            # lint + format check (Ultracite)
bun run fix                              # auto-fix lint + format
bun run --cwd apps/app test              # all tests — once, before declaring done
```

## Development Guidelines

- Verify in tiers. The full browser suite takes ~2 min, so don't run it after every edit.
  - While iterating: only the tests you touched or that cover what you changed (`bun run test:unit <path>`, `bun run test:browser <path>`, or `bunx vitest run --changed` from `apps/app`), plus `bun run check-types` (~8 s).
  - Once, before declaring done: `bun run check`, `bun run check-types`, `bun run --cwd apps/app test`. Rerun only the files that failed, not the whole suite.
  - Coverage (`test:coverage`) and e2e (`bun run --cwd apps/app e2e`) only when asked, or when the change touches a flow under `apps/app/e2e/`. CI gates both.
  - Never poll with `sleep` loops. Start long commands in the background and wait for the completion notice.
  - Formatting runs per edited file through the Claude hook. There are no git hooks; GitHub CI gates lint, types and tests.
- Do not stop mid-implementation. Execute all tasks of a plan sequentially; pause only for explicit user questions.
- Fix CI failures at the root cause. Never loosen thresholds or disable checks.
- Before implementing a GitHub issue, verify the branch and create a feature branch if on `main`.
- Always write tests for new code. Colocate `*.browser.test.tsx` (UI/hooks) or `*.test.ts` (pure logic) next to the unit. Cover rendering, primary interactions, and conditional branches. CI gates Vitest + Playwright at 80% line coverage.
- **Driving the native app**: use the `cua-driver` skill (CLI by default) as the default way to interact with the running desktop app (`desktop:dev`): summon the launcher, type, click, take screenshots and verify UI state. Use Playwright/`agent-browser` only for the browser build (`dev:web`, e2e).

## Monorepo

- `apps/app/` — desktop app: React 19 in `src/mainview/`, bun process in `src/bun/`, Electrobun, TanStack Router, Vite, Tailwind v4.
- `apps/video/` — Remotion product videos for X (1920×1080). `ShowcaseReal` cuts the real launcher out of recordings in git-ignored `public/footage/` and stages it with headlines (see its README to re-record); `Showcase` redraws the launcher frame by frame. `bun run --cwd apps/video studio` previews; `render:real` / `render` write to `out/`. No `dev`/`build` scripts so Turborepo never starts or renders it.
- `packages/config/` — shared `tsconfig.base.json`.
- `packages/agent/` — the bun-side AI ask pipeline (AI SDK v6). Tests run with `vitest run` and the `ai/test` mock model.
- `packages/env/` — type-safe env vars (`@t3-oss/env-core`, Zod) in `packages/env/src/web.ts`. Web vars must be prefixed `VITE_`.
- Workspace packages: `@conch/*` via `workspace:*`. Shared deps via bun's `catalog:` in root `package.json`.

## Architecture (`apps/app`)

- **Product shape**: a Raycast-style launcher. A global hotkey (default `Option+Shift+Space`, override via `launcherHotkey` in the app config) summons one translucent panel. The only other windows are boards.
- **Launcher window** (bun, `src/bun/launcher.ts`): one frameless, transparent, always-on-top panel (800 pt wide incl. a 20 pt shadow margin, top edge at 22% of the cursor's screen), a `GlobalShortcut`, a template `Tray` (`assets/tray-template.png`), no Dock icon. Bun only shows/hides the native window; the renderer owns visual state.
  - Hotkey: `registerLauncherHotkey` (`launcher-hotkey.ts`, pure) first asks for a system hot key through `native/hotkey.c` (Carbon `RegisterEventHotKey`, built into `libconch-hotkey.dylib` by `scripts/copy-bun-assets.ts`, loaded by `hotkey-native.ts`). It needs no Accessibility trust, swallows the keystroke and fires while Conch is active, so bun toggles the panel itself and records a focused board as the one to return to (`onHotkeyPressed` in `index.ts`). Carbon calls belong to the main thread, so the C helper dispatches there and calls back through a thread-safe `JSCallback`.
  - Hotkey fallback: when the helper is missing (no clang at build time) or the system refuses the key, Electrobun's `GlobalShortcut` takes over. It is an NSEvent global monitor, so it needs Accessibility trust (`requireAccessibility` prompts and re-registers once granted) and never sees keys while this app is active. For that case the renderer still closes the panel on its own hotkey (`matchesAccelerator`) and board windows forward it through `toggleLauncher({ fromWindowKey })`.
  - Focus: hiding the launcher hands focus back through `focusAfterLauncherHides` (`focus-policy.ts`, pure): keep a focused board, activate the board it came from, `deactivate` while other boards are open, otherwise `-[NSApplication hide:]` (`app-hide-native.ts`). A blur before `rendererReady` hides natively.
  - Messages: `launcherShown` (bun showed the window), `launcherToggle` (hotkey while visible — renderer reverses whatever is in flight), `launcherDismiss` (window blur), `launcherNavigate`. Requests: `resizeLauncher` (renderer measures, bun sets the frame), `hideLauncher` (renderer calls it after the exit animation).
  - Frame math lives in `src/bun/launcher-geometry.ts` (pure, tested). Keep `@conch/core` out of `src/bun/index.ts` imports — evaluating its WASM top-level await before `electrobun/main` deadlocks the worker.
- **Launcher UI** (`src/mainview/components/launcher/`): `LauncherPanel` composes `LauncherSurface` (summon/dismiss + height morph synced to the native frame) and a stack of views (`useLauncherStack`, push/pop, Esc order: pop → clear query → dismiss). Views live in `launcher/views/`; new screens are new `LauncherView` variants, not routes. `LauncherSurface` animates height with Motion layout projection anchored by `originY: 0` (not a CSS `transformOrigin` string); avoid content that changes height every frame. List views cap the panel at 476 pt and scroll; answer views (`ask`, `lookup`, `widget-run`, `watch`, `import`) get 680 (`panel-height.ts`). The panel is one surface: no hairline under the input, and `LauncherFooter` is a status capsule and an actions capsule that overlap the body's bottom edge (negative margin, no positioned ancestor needed). Every view body reserves that room with `launcher-body`; `LauncherScrollArea` puts it inside the scroll content and fades the edges that have more to scroll. The root and History hold their body height while a query is typed (`useSteadyHeight`), so the footer does not move as results narrow. Typed search keeps Ask (and Look up) first so ↵ always asks; every other match is one `Results` list ranked across kinds (`rankRootItems`, one `rankByTerms` scoring path in `lib/fuzzy-match.ts`), each row naming its kind in the trailing column (`RowTrailing`, shown only in the flat list), then a `Use “…” with…` section (Search History, Find Table) so the root never dead-ends. Commands `Run SQL`, `Browse Tables` and `Switch Connection` fill the `>`, `#` and `@` prefixes. While the field is empty, `PrefixHints` keycaps for `>` and `#` sit before ↵ (the connection chip stands for `@`), so the placeholder stays a plain "Search or ask…". Returning to the root (a pop or a re-summon) selects the query so typing replaces it. Every root row has a `⌘K` menu (`useRootMenus`: connections, widgets and boards keep their own menus, every other kind uses `rowActions`); each menu leads with the row's ↵ action, and the action it labels ⌘↩ is what `⌘↵` runs (`secondActionOf`). `ActionsMenu` filters as you type (field at the bottom, Esc clears then closes, a divider before destructive actions); `useFilteredList` holds that keyboard contract and `ScopeFilter` reuses it.
- **Ask view** (`src/mainview/components/ask/`): free text at root shows an "Ask {connection}" row first; ↵ pushes the `ask` view. The generated query stays collapsed while it streams; it opens only when the user toggles it (or on an error). `useAsk` (owned by `LauncherPanel` via `useLauncherAsk`, so ↵ on that ask's Recent row shows the answer again without asking; ↑/↓ on the root only ever move the selection) reduces `AskEvent`s in `ask-reducer.ts`; `usePhaseDisplay` owns the 150ms/300ms working-state timing. `AskCard` depends only on `{ spec, result, view }` so widgets and boards can reuse it; pure transforms live in `lib/card-data.ts`. In browser mode the stub replays recorded asks (`lib/browser-ask-stub.ts`): "signups" → stacked bar, "delete/drop…" → refusal, anything else → revenue by region; a `mongodb` connection replays "orders by status" and a `redis` one "keys by pattern" or "leaderboard", with "merge/delete/set…" refused.
  - Refine: the reducer keeps a chain of up to 6 turns (`turns`/`position`; selectors `shownTurn`, `refineContextOf` in `ask-chain.ts`). ↵ refines the shown question turn (`ask` with optional `AskParams.refine`, never an `AskEvent`/`CardSpec` change), ⌘↵ asks a new question, ↑/↓ on an empty input step turns, and "as a table"-style phrases only switch the view. Raw `>` SQL and match answers never refine: plain text starts a new question. The card never unmounts across a refine (`AskAnswerView` dims it under `ProgressHairline`, then morphs with `intro="update"`). Assumptions come from the bun `describeSql` request (polyglot, `describeSqlAssumptions` in core), never the model; chips show readable filter labels (`filter-label.ts`) with the SQL as a tooltip; drill-down attaches through `DrillProvider`, which only `AskView` mounts, and always pre-fills instead of running. Recents keep one entry per chain (`id` = the chain's first `askId`).
- **Widgets** (`src/mainview/components/widgets/`, `src/bun/widget-service.ts`): a saved answer is a `Widget` (SQL template + `CardSpec` + typed `ParamDef` inputs, contracts in `@conch/rpc` `widget.ts`, protected). Templates use `{{name}}` / `{{range.from|to}}`; `compileSqlTemplate` (core) only swaps placeholders for driver markers, so values always travel as bind parameters (`ExecuteOptions.params`). The bun service validates values with zod, runs read-only, and stores `widgets.enc` / `recent-asks.enc`. Runs never call the AI; `proposeParams` (agent) only runs on ⌘⇧S and rejects templates that change more than literals. A removed input becomes `fixed` (still bound), never spliced back into SQL. Root shows Recent, Widgets and Boards; Tab on a widget opens argument pills (`arguments/`); ⌘K on a widget or board row opens the catalog actions (`views/use-catalog-menu.ts`).
- **Sources** (`@conch/rpc` `source.ts` + `source-config.ts`, core `json-select.ts`/`to-tabular.ts`/`arg-template.ts`/`request-url.ts`, `src/bun/source-runner.ts`, renderer in `components/sources/`): a widget is `Widget` v2 with `source: Source` (`sql | mcp | http`, protected; v1 records upgrade on parse in `parseStoredWidget` and are rewritten as v2 only when saved, other records are kept). `createSourceRunner().run` is the one path for every run (interactive, board, watch, agent MCP) and returns `{ result: TabularResult, compiled: CompiledSource }`. MCP widgets call a tool through `mcp-clients.ts` (`@modelcontextprotocol/sdk` `Client`, never named `mcp-server`; stdio gets a minimal env plus its own values; 60 s tool cache, 2 calls per server, 5 min idle close) and only when `isReadEligible` (`readOnlyHint === true` or the user's "Treat as read", checked on every run); args are a JSON template whose `{"$param": …}` objects `bindArgs` swaps for typed values. HTTP widgets are GET only (`buildRequestUrl` keeps the origin and base path, `fetchJson` never follows redirects, JSON only, 5 MB cap). Servers and endpoints live in `mcp-servers.enc` / `http-endpoints.enc`; the renderer only sees redacted secrets. A new or changed command/URL and every "Treat as read" need a native `confirmNative` dialog (Cancel default). Authoring (`proposeSource` in agent, `previewSource`) is the only AI step; runs never call the model. Bundles (plan 015) export SQL widgets only; the agent MCP server exposes SQL widgets only.
- **History** (`src/mainview/components/history/`): `recent-asks.enc` keeps the last 200 asks (prompt, SQL, `CardSpec`, never rows), deduped by connection + prompt. Root fetches only `RECENTS_SHOWN` via `listRecentAsks({ limit })`; the `history` view (⌘Y or "Search History", which can arrive with a query) loads all, groups by local day, shows two-line rows (prompt and time, then connection and the first line of the SQL), narrows to one connection with `⌘P` (`ScopeFilter`), searches prompt/title/connection/SQL words (`history-search.ts`), and asks again, runs the SQL without AI, copies, saves as a widget, removes (⌃X) or clears (armed) through `deleteRecentAsk` / `clearRecentAsks`.
- **Boards** (`src/mainview/components/board/`, `src/bun/board-service.ts`, `src/bun/panel-windows.ts`): a `Board` (contract and pure tile ops in `@conch/rpc` `board.ts`) is a 12-column grid of tiles (`s|m|l|wide` → 3/4/6/12 columns) pointing at widgets, plus `sharedValues` keyed by `name:type` and a `refresh` interval. Stored in `boards.enc` (`createBoardStore` over core's generic `createRecordStore`); deleting a widget removes its tiles and broadcasts `boardChanged`. Each board is a normal titled `BrowserWindow` loading `#/board/:id` with its own RPC (handlers shared, `createAppRpcs`); frames persist in `board-frames.json`. The renderer runs tiles through `useBoardRefresh` (at most 4 concurrent `runWidget`s, cancels superseded runs, interval paused while `document.visibilityState` is hidden). Shared inputs are the union of tile params by `name:type`; changing one re-runs only the tiles that use it (`board-inputs.ts`). Edit mode (⌘E) adds drag handles (`use-tile-drag.ts`: 1:1 pointer, momentum projection, `SPRING_MOMENTUM` settle) and ⌥-arrow move/resize. The launcher adds boards through `board-picker` / `board-name` views.
- **Mini-apps** (`src/mainview/components/mini-app/`, `src/bun/mini-app-service.ts`, `src/bun/mini-app-gen-service.ts`): a saved, generated tool. Contracts in `@conch/rpc/mini-app` (protected): `MiniApp`/`MiniAppDraft` (`mini-app.ts`: typed inputs, named 018 `Source`s, 019 `ActionDef`s, `refreshAfter`, `values` by `name:type`), `PanelSpec` (`panel-spec.ts`: flat `{root, elements}` of `Stack|Grid|Card|ActionButton|Heading|Note`; cards hold `{ $state: "/sources/<name>" }` pointers, never rows; no `insight`) and `MiniAppGenEvent`; `mini-app-patch.ts` `applyDraftPatch` allow-lists JSON Patch paths and rejects prototype keys. Stored in `mini-apps.enc` (`@conch/core/mini-apps`). "Build an app" (root row after Ask, or New App) streams `generateMiniApp` (agent, JSONL patches over the `miniAppGenEvent` message, ≤2 repairs, runs only read sources from the chosen catalog); the launcher's `mini-app-generate` view assembles the draft with the in-house `PanelRenderer` (walker + `useSyncExternalStore` store + `isVisible`), lazy-loaded. Runs never call the AI: bun runs a saved app's (or bun's own draft's) source by name (`runMiniAppSource`), never a definition from the renderer. Saving needs a review tick for every new or changed non-copy action (`needsReview`), plus the write opt-in and 019's native dialog for writes; from an app window bun accepts only parts already saved or generated by bun for that app (`fromGenId`), and duplicate/delete are launcher-only. Streamed layout patches pass `streamingLayoutProblem` (no cycles, repeats or depth > 4). Saved apps open in their own window (`#/app/:id`, `panel-windows.ts`, window key `app:<id>`); a window only stages its own app's actions (bun binds each window RPC to its `PanelRef`, requires focus and rate-limits), the launcher ignores navigation while a confirm sheet is open, and it prepares, confirms and runs them through 019 (a staged link waits for one ↵) (`prepareMiniAppAction` → confirm sheet → `executeAction`), then bun broadcasts `miniAppRefresh`. ⌘E edits (⌥-arrows move/resize, two-press removes), ⌘⇧E changes the app with a prompt on a copy. The browser stub replays recorded builds (`lib/browser-mini-app-recordings.ts`: "refund desk", "broken" fails).
- **Agents (MCP)** (`src/bun/mcp-server/`, `src/mcp-bridge/main.ts`, renderer in `components/agents/`): an opt-in, read-only MCP server for local agents (Claude Code, Cursor). Clients spawn the dependency-free bridge (`bun/mcp-bridge.js` inside the `.app`, built by `scripts/copy-bun-assets.ts`), which connects to `~/.config/conch/run/mcp.sock` (0600 socket in a 0700 dir, no TCP), sends a `{"conch":"hello","v":1,"token"}` line and then pipes stdio. Each client gets its own `McpServer` with five tools (`list_connections`, `describe_schema`, `ask`, `list_widgets`, `run_widget`), all `readOnlyHint`, none taking SQL; they reuse `buildAskPorts` (`ask-ports.ts`) and `runDetached(..., { record: false })`. `mcp-policy.ts` checks exposure on every call (unexposed = `NOT_FOUND`), caps rows/cells/payload, applies PII redaction and scrubs host/user/password from errors. Settings (`mcp.enc`, token never leaves bun; the renderer sees `RedactedMcpSettings`) and the audit log (`mcp-audit.enc`, no rows) live in `@conch/core` `mcp-store.ts`; contracts in `@conch/rpc` `mcp.ts` are protected. Calls show in the tray (active glyph + menu line) and the launcher footer via the `mcpActivity` message.
- **Actions** (`@conch/rpc` `action.ts` protected, agent `write-guard.ts`/`propose-action.ts`, core `actions.ts`/`audit-log.ts`/`write-ast.ts`, `src/bun/action-service.ts` → `action-executor.ts`, renderer in `components/actions/` and `components/activity/`): a `WidgetAction` (stored in `actions.enc` keyed by `widgetId`; `Widget` is unchanged) targets `copy | open-url | sql | mcp | http` with `bind` sources `row | input | literal`. Bun derives the effect on every call (`deriveEffect`: copy/GET/`readOnlyHint === true` read, open-url external, everything else write; "Treat as read" never counts) and refuses a stored effect that understates it or a `reviewHash` that no longer matches. Writes run only through `prepareAction` (compiles the call, row values from bun's `run-cache.ts` by `runId` + `rowIndex`, 128-bit single-use token, 120 s) → `executeAction({ token })` (re-checks permission, effect and call hash; appends a `started` entry to `actions-audit.enc` or refuses, then `finished`). SQL writes pass `assertGuardedWrite` (two lexer flavors + polyglot AST) and run on the separate `GuardedWrite.executeWrite` capability (pg, mysql, sqlite, duckdb, mssql: transaction, 15 s, rollback over `maxAffectedRows`). "Allow write actions" lives in `write-permissions.enc` (never on `DatabaseConnection`); enabling it and saving a write action each need `confirmNative`. Only the launcher RPC has action methods and caches runs; boards, the MCP server and `conch://` links can't reach them. The confirm sheet is a modal alertdialog: focus on Cancel, ⌘↵ only after 600 ms, ↵ never confirms. Activity (root command and Settings) reads the hash-chained log. The browser stub (`browser-action-stub.ts`) accepts every native dialog.
- **Links** (`conch://`, `app.urlSchemes`): `parseConchLink` in `@conch/rpc` `conch-link.ts`; `src/bun/link-router.ts` subscribes to `open-url` before `main()`'s first await and maps links to `launcherNavigate` views. Links only stage: `ask-draft` fills the input (↵ asks, switching to the named connection then), `widget-args` opens the pills, only a bare widget id runs. The renderer stages them in `launcher/links/` (`useStagedLink`). Logs name the route, never the text. The browser stub exposes `globalThis.__conchOpenLink(url)` for e2e.
- **Connections + settings**: `ConnectionsProvider` (`launcher/connections/`) owns the list, active connection and live sessions for every view. It also holds the New Connection draft (`keepDraft`/`discardDraft`): leaving the form unsaved keeps it as a `Drafts` row at the top of the root (↵ reopens, ⌃X discards). Drafts live in renderer memory only, never in storage or bun, because they can hold a password. The AI key is encrypted in `ai.enc` by `@conch/core`; the renderer only ever sees `RedactedAiSettings`. App data lives in `~/.config/conch` (`paths.ts`); on launch `migrateAppData` moves a legacy `~/.config/oh-my-query` there. Only the legacy keyring service still uses the old name on purpose. With no connections, the root offers `Try the Sample Database` (`useSampleDatabase`): bun's `sample-service.ts` writes a generated SQLite store to `~/.config/conch/sample` (`sample-data.ts` is pure and seeded, `sample-database.ts` writes it), adds the `sample-store` connection and saves three starter widgets.
- **Updates and releases** (`src/bun/updater.ts`, `.github/workflows/release.yml`, `RELEASING.md`): `createUpdateService` drives Electrobun's `Updater` behind a small port: a check 30 s after launch and every 6 h, a silent download, then a tray item (`Restart to Update to …`) and Settings → About. The channel is the build's own (`stable`, `canary` shown as Beta, `dev`), never a setting. Every channel reads one rolling GitHub release tagged `updates` (`UPDATE_FEED_URL` in `electrobun.config.ts`, built into each copy). Tags `v<X.Y.Z>` and `v<X.Y.Z>-beta.<N>` release macOS only as `Conch_<version>_<arch>.dmg`; a stable release must be signed.
- **Feedback** (`src/bun/feedback.ts`): the `Send Feedback` command asks bun to open a new GitHub issue with the version, channel, macOS release and architecture filled in. Bun builds the URL; no window can ask it to open another one.
- **Themes** (`@conch/rpc` `theme.ts` protected, `theme-color.ts`, `theme-contrast.ts`, `theme-builtins.ts`; `@conch/core/themes`; `src/bun/theme-service.ts`; renderer `lib/theme/` and `components/themes/`): a `Theme` is a name, an appearance and a value for each of the 48 tokens in `THEME_TOKEN_GROUPS` (adding one needs a `THEME_VERSION` bump). Values follow one strict grammar (`#rrggbb`, `#rrggbbaa`, `oklch(L C H / A)`), the only thing between an imported file and `style.setProperty`. Four built-ins (Conch and Amber, dark and light) live in code; custom themes in `themes.enc`; `ThemeSettings` (`mode` System/Dark/Light plus one theme id per appearance) in `conch.json` `theme`. The service validates, repairs dangling ids, caps 50 custom themes, exports `<slug>.conch-theme.json` to Downloads and imports through `pickFile` inside `runModal` (64 KB); every change broadcasts `themeChanged` to every window, and only the launcher may change themes (`launcherOnly`). `themeContrastReport` runs the audit pairs on any theme: below the minimum warns, and `foreground` on `background`/`panel` or `primary-foreground` on `primary` below 3:1 blocks saving and importing. The renderer store (`initTheme()` in `main.tsx` before the first render) applies the `localStorage["conch-theme"]` cache first, then bun's state, and holds a `preview` that wins until released (`useThemePreview`). Views: `themes` (Dark/Light sections, selection previews, ↵ uses and switches the mode unless System, ⌘K menu, ⌘N new, ⌘O import, ⌘E edit, ⌃X ⌃X delete) and `theme-edit` (every token with a `react-colorful` popover, hex and opacity fields, a scoped `ThemePreview` strip, contrast notes, ⌘S, Esc Esc discards; a blocked draft previews only in the strip). Browser mode emulates the service in `lib/browser-theme-stub.ts`; e2e imports through `globalThis.__conchThemeImport`.
- **Motion system**: tokens and `useMotionPreset()` in `src/mainview/lib/motion.ts` (`SPRING`, `SPRING_SNAPPY`, `SPRING_SOFT`, `SPRING_MOMENTUM`, `FADE_IN/OUT`, `PRESS`, stagger); primitives `Pressable`, `SwapText`, `Reveal` in `components/motion/`. `?slowmo=4` (dev only) slows every animation for recordings.
- **AI (ask pipeline)**: `@conch/agent` runs in the bun process, never the renderer. `runAsk(prompt, ports, signal)` is a pure async generator (schema → streamed SQL → `assertReadOnly` guard → read-only run with up to 2 repairs → `CardSpec`) over injected ports; `src/bun/ask-service.ts` wires ports to pools and forwards `AskEvent`s via the `askEvent` message (`ask`/`cancelAsk` requests, one active ask per connection). `CardSpec` and `AskEvent` in `@conch/rpc` are protected contracts: change them only with a `CardSpec.version` bump (now 2; v1 records upgrade on parse). Every SQL driver honours `Pool.execute(..., { readOnly: true })` on the same connection. `AskPorts.engine` (`sqlEngine(dialect)`, `mongoEngine`, `redisEngine`) owns the prompt, schema formatter and guard per `QueryLanguage`; Mongo/Redis asks are allowlist-guarded JSON (`parseMongoReadQuery`/`parseRedisReadPlan` in `core/client`) run by `runMongoReadQuery`/`runRedisReadPlan` (`@conch/drivers/read`, Redis on a duplicated client, never `SELECT`); widgets stay SQL-only.
- **Routing**: TanStack Router with hash history: `/` is the launcher, `/board/$boardId` a board window; `routeTree.gen.ts` is generated into `src/mainview/` — don't edit.
- **Path alias**: `@/` → `apps/app/src/mainview/` (configured in `vite.config.ts` and `tsconfig.json`).
- **Styling**: Tailwind v4 via `@tailwindcss/vite`. CSS entry `src/mainview/index.css`. Color tokens come from theme data (see Themes) applied as inline custom properties on `<html>`; `index.css` keeps only non-color tokens, the aliases (`--card-foreground`, `--popover*`, `--shadow-panel`) and the `prefers-contrast: more` overrides (`!important`, to beat the inline values). The Conch themes are neutral gray `oklch` with one vermilion `--brand` (the mark, the input caret, progress only); `bg-scrim` is the dialog backdrop, `--shadow` colors the panel and capsule shadows, and `dark:` follows the `.dark` class (`@custom-variant dark`). `apps/app/scripts/audit-contrast.ts` checks every pair of every built-in theme and writes `apps/app/docs/color-tokens.md`. The panel material is the `launcher-material` utility (`--panel*` tokens, falls back to opaque under `prefers-reduced-transparency`); footer capsules use `capsule-material`, view bodies `launcher-body` (`--launcher-footer-clearance`, also the scroll padding), scroll areas `scroll-fade`; type roles are `type-input|title|body|meta|micro` utilities. Fonts: Mona Sans Variable (UI), JetBrains Mono (SQL/data).
- **UI**: shadcn/ui (base-mira, non-RSC) in `src/mainview/components/ui/`. Add via `bunx shadcn@latest add <component>` from `apps/app/`.
- **Theming**: the renderer's theme store (`lib/theme/`), dark default, class-based (`.dark`/`.light` on `<html>`).
- **Desktop runtime**: Electrobun 2 (pinned exactly in `apps/app/package.json`; keep it on the latest stable, never a beta). The CLI runs through Hutch, which downloads the toolchain into `~/.hutch` and projects the SDK into `apps/app/.hutch/devkit` (git-ignored). Vite bundles the renderer into `dist/`, copied to `views/mainview/` inside the `.app` and loaded from `views://mainview/index.html`. The bun-side bundles from `src/bun/index.ts`.
  - SDK imports: `electrobun/main` (bun side) and `electrobun/view` (renderer). They resolve from the devkit, not `node_modules`: `tsconfig.json` paths point at declarations generated into `.hutch/types`, and `vite.config.ts` aliases `electrobun/view` to the devkit source.
  - `bun install` runs `postinstall` → `electrobun:prepare` (`electrobun sync` + `scripts/electrobun-types.ts`). Rerun `bun run --cwd apps/app electrobun:prepare` after changing the Electrobun version.
  - Router uses hash history so the packaged `views://` page resolves routes.
  - RPC: `Electroview.defineRPC` (renderer, `src/mainview/lib/ipc.ts`) ↔ `defineElectrobunRPC` (bun, `src/bun/rpc.ts`).
  - DB drivers + persistence: `@conch/core`, `@conch/drivers`, `@conch/drivers-redis`. Consumed by `src/bun/rpc.ts`.
  - `@polyglot-sql/sdk` WASM is copied next to bundled bun code via `apps/app/scripts/copy-bun-assets.ts` (runs before `electrobun dev`/`build`).
  - Vite must use `base: "./"` so `dist/index.html` uses relative asset paths.
- **State**: Custom hooks centralize logic (`useLauncherStack`, `useLauncherPresence`, `useWindowHeightSync`).
- **Animation**: `motion` (v12+) through the motion system above. `layout`/`layoutId` for morphs and shared elements, `AnimatePresence` for enter/exit, springs for anything interruptible; CSS `@keyframes` only for ambient loops. `MotionConfig reducedMotion="user"` wraps the app and every animation has a reduced-motion path.
- **Tests**: `emitIpcMessage()` (`src/mainview/test/ipc-mock.ts`) delivers bun → renderer messages through the real `@/lib/ipc`. In browser mode (`dev:web`, e2e) the IPC stub emulates the window: `hideLauncher` hides it, `Option+Shift+Space` plays the global hotkey, `openBoard` opens `#/board/:id` in a new tab, and `globalThis.__conchIpcLog` records every request for e2e assertions.

## Conventions

- **Bun** v1.4.4. **Turborepo** for builds.
- **Formatting** (Oxfmt): double quotes, semicolons, 2-space indent, ES5 trailing commas, sorted imports.
- **Linting** (Oxlint + Ultracite core/React presets).
- **TypeScript**: strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`. No `any`, no unsafe casts, no `// @ts-expect-error` without a one-line _why_.
- **React 19**: ref as a prop. Never `forwardRef`.
- **No code comments by default.** Don't narrate code, restate identifiers, or leave change-log breadcrumbs ("added X", "now uses Y", "removed Z"). Rename, restructure, or push the explanation into the commit/PR. Comment only when the _why_ is non-obvious — a hidden constraint, subtle invariant, or specific-bug workaround — and keep it to one short line.

## Skills

Activate on React/TypeScript work:

- `vercel-composition-patterns`
- `vercel-react-best-practices`
- `web-design-guidelines`

## Code quality bar

Every change is held to a senior bar.

- **Clean.** Self-explanatory names. One thing per function at one level of abstraction. No dead code, commented-out blocks, or stray `console.log`. Early returns over nested branches. Pure where possible; isolate side effects at the edges.
- **Modular.** Small units with a single reason to change. Co-locate component + hook + types + test. Cross module boundaries only through public surfaces. No circular imports.
- **Extensible, not speculative.** Compose over inherit. Data + behavior over flags. Generalize on the second caller, not the first.
- **SOLID with judgment.** SRP per module/component/hook. Extend via composition (children, slots, render props, hook factories), not prop explosion. Depend on the narrowest interface that does the job.
- **Errors at the right boundary.** Don't bury, swallow, or rethrow generically. Validate at system edges (user input, RPC, drivers). Trust internal contracts.
- **Tested.** Unit test pure logic. Render + interaction test components and hooks. Snapshot critical UI states (empty, loading, error, populated). 80%+ line coverage required; no critical paths untested.

### React rules

- **Small components.** > ~150 lines, or > 1 distinct responsibility (data + layout + interaction) → split.
- **One component per file.** File name matches the export (`connection-form.tsx` → `ConnectionForm`). Tiny private subcomponents may share the file; reused ones move out.
- **Clean props.**
  - Cap ~6 props. More → split, or accept a typed object (`config`, `connection`).
  - No boolean prop proliferation. Use `variant` / `size` / `state` enums or compose. See `vercel-composition-patterns`.
  - Props say _what_, not _how_. Prefer `children`/slots over `renderXxx` props.
  - Type precisely. No `any`, no `Record<string, unknown>` escapes. Discriminated unions for variant shapes.
- **State.**
  - Live at the lowest component that needs it. Lift only when siblings genuinely share it.
  - Derive in render (or `useMemo` if measurably costly). Never store derived state and sync via `useEffect`.
  - Group fields that always change together (`useReducer` when transitions matter).
  - Async/server data uses project hooks (`useConnections`, `useQueryTabs`), not `useState` + `useEffect`.
  - If you need global state, use zustand or React Context — but prefer colocation and prop drilling.
- **Hooks.**
  - Top level only. Names start with `use`.
  - `useEffect` syncs with external systems — it's not "after render." Derive what you can; handle events in handlers.
  - Exhaustive dep arrays. Never silence the lint rule — fix the design.
  - Clean up subscriptions/timers/listeners in the same effect.
  - Extract reusable stateful logic into custom hooks (one purpose, stable shape).
  - `useCallback` / `useMemo` only for real referential-stability or cost reasons. Don't sprinkle prophylactically.
  - Use React 19: `use`, ref-as-prop, Actions, `useId`, `useSyncExternalStore`. See `vercel-react-best-practices`.

## Component & route composition

Routes orchestrate; they don't implement. > ~100 lines → extract.

**Where things live**

- Reusable primitives (buttons, inputs, popovers): `apps/app/src/mainview/components/ui/`.
- Cross-screen feature components: `apps/app/src/mainview/components/<feature>/`.
- Screen-specific components: `<route>/-components/` (the `-` prefix is ignored by TanStack Router).
- Screen-specific hooks: `<route>/-hooks/`.
- App-wide hooks: `apps/app/src/mainview/hooks/`.

**Patterns**

- Many small single-purpose components beat one large one — even for one-time uses.
- Children own the hooks/handlers they need. Don't thread state through routes when the child can own it.
- Group related state + effects into purpose-named hooks (`useConnections`, `useConnectionSelection`, `useHomeIslandSync`, `useHomeHotkeys`).
- Titlebar actions, empty states, populated states — separate components, switched via `AnimatePresence`.
- Hotkey wiring lives in a `useXxxHotkeys` hook, never inline.

**Stays in the route**

- Cross-cutting flow `useState` (welcome/glow timers coordinating island + dialog state).
- Dialog mounts (`<AddConnectionDialog>`, `<EditConnectionDialog>`) — siblings of the main view.
- Top-level layout: `<Titlebar>`, scroll container, `AnimatePresence` switcher.

**Don't over-engineer**

- No `components/ui/` primitive for a single use site. Wait for caller #2.
- Don't split a 30-line component to hit a count. Split when responsibilities (data / layout / interaction) earn names.

## Tests

Vitest 4 browser mode (Playwright + Chromium) via `vitest-browser-react` for all React tests — components and hooks alike. Pure-logic, no-DOM tests stay as `*.test.ts(x)` in the jsdom `unit` project.

- Pattern: `import { render } from "vitest-browser-react"; const screen = render(<Component … />)`. Query with `screen.getByRole(...)`. Interact with `await el.click()`. Snapshot with `expect(el.element()).toMatchSnapshot()` or `expect(screen.container).toMatchSnapshot()`. Negative assert: `screen.getBy*(...).query()` returns `null`.
- Hooks: `import { renderHook, waitFor } from "@/test/render-hook"` — same shape as the historical `@testing-library/react` API (`{ result, rerender, unmount }`, `renderHook(cb, { initialProps })`).
- Snapshots committed in `__snapshots__/` next to each test. `src/mainview/test/setup-browser.ts` strips volatile inline styles (`transform`, `opacity`) so motion-driven components serialize stably.
- Scripts (from `apps/app`):
  - `bun run test` — both projects.
  - `bun run test:unit` — jsdom logic-only (`*.test.ts(x)`).
  - `bun run test:browser` — interaction + snapshot (`*.browser.test.tsx`).
  - `bun run test:watch` — watch mode for both.
  - Scope: append a path, e.g. `bun run test:browser src/mainview/components/ui/button.browser.test.tsx`.
- Update snapshots: `bun run test:browser -- -u`. Review the diff like code.

### Brand Personality

- **Three words**: _warm · craft · trustworthy_
- **Voice**: Quiet confidence. No marketing language, no hype, no "✨ AI-powered." Talks to the user like a senior colleague who respects their time.
- **Emotional goal**: A tool you're genuinely happy to sit inside for a 3-hour debugging session — the kind of care you feel in Things 3, Postico, or Linear.

### Aesthetic Direction

- **Lineage**: Refined & native-calm. Positive references: **TablePlus, Postico, Things 3, Linear, Arc**.
- **Anti-references**:
  - **DBeaver / phpMyAdmin / pgAdmin** — bureaucratic default panels, icon-heavy toolbars, zero personality.
  - **Generic AI-app UI** — purple/cyan gradients, neon accents on dark, sparkle icons, chatbot drawer bolted onto an admin UI.
- **Theme**: Dark-first, neutral gray close to native macOS (Raycast is the reference), with one vermilion brand color (`oklch(0.66 0.22 29)`) kept for the mark, the caret and progress. Light mode exists; dark is the hero. Brand assets are rendered from `.github/brand/conch-mark.svg` by `apps/app/scripts/build-brand-assets.ts`.
- **Typography**: The `-apple-system` stack is a placeholder — the biggest gap to fill. Pair a distinctive display/UI face with a refined mono for SQL and data. Avoid Inter, IBM Plex, Space Grotesk, Fraunces, Instrument Sans.
- **Motion**: iOS-like springs, purposeful, never decorative. Must degrade cleanly under `prefers-reduced-motion`.
- **Signature moment**: The launcher's ask flow (`.factory/plans/005`): one panel that morphs from question → streaming SQL → running → chart card. Invest here first.

### Design Principles

1. **Calm chrome, one red.** Surfaces are neutral gray so the user's data carries the color. Vermilion marks the brand and the moment something is in flight; it is never a status color.
2. **Native-calm, not native-cosplay.** Inherit macOS discipline (keyboard-first, quiet chrome, real vibrancy, deliberate motion) — don't imitate macOS widgets.
3. **The AI disappears into the editor.** No chatbot drawer aesthetic, no sparkle iconography. AI output lands in the editor like a colleague pasted it, not like a product feature.
4. **Density with breathing room.** Resolve pro-user density and calm space through typographic rhythm and varied spacing — not cards on cards or hidden disclosure.
5. **Keyboard + AT are non-negotiable.** Focus rings always visible. WCAG AA contrast everywhere, including on the translucent launcher panel. `prefers-reduced-motion` fully respected.
6. **Make the launcher's ask flow the signature.** When something wants to be distinctive, put the effort here first.
