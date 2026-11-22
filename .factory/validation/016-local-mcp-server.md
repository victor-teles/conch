# Validation: plan 016, local read-only MCP server

Date: 2026-11-21. Worktree `t3/remotion-video-app` on `7888eab`, uncommitted.
Verdict: **partially verified**. Every automated check this change owns
passes, and the packaged app served the five tools to a real MCP client
through the real bridge. The steps that need the desktop UI, a real AI key or
a person's judgment have not been run.

## What was built

- **Contracts (rpc, protected).** `mcp.ts`: `McpSettings`, `McpSettingsUpdate`,
  `RedactedMcpSettings` (adds `startError`), `MCP_TOOLS`, `McpAuditEntry`,
  `McpActivity` (adds `id`), `McpClientKind`, `mcpActivityPhrase`,
  `mcpTokenPreview`. Six requests and the `mcpActivity` message in `RpcSchema`.
- **Stores (core).** `mcp-store.ts`: `readMcpSettings` (an unreadable or
  invalid file falls back to fresh, disabled settings), `writeMcpSettings`,
  `appendMcpAudit` / `listMcpAudit` / `clearMcpAudit` (encrypted JSONL,
  trimmed to 1,000 past 2,000). Paths `mcp.enc`, `mcp-audit.enc`, `run/`.
- **Shared ports.** `ask-ports.ts` holds `buildAskPorts` and friends moved out
  of `ask-service.ts` with no behavior change (its 31 tests unchanged).
  `runDetached(..., { record: false })` so agent runs never touch `lastValues`
  or evict a watch's run-log entry.
- **Server (`src/bun/mcp-server/`).** `mcp-policy.ts` (pure exposure, name
  resolution, shaping, caps, PII redaction, secret scrubbing), `limits.ts`
  (2 concurrent, 30/min per client, 1 agent ask per connection),
  `activity.ts` (broadcast + tray line with 1.5 s linger), `tool-call.ts`
  (limits, timeouts, error mapping, audit), `tools.ts` (five tools, all
  `readOnlyHint`), `socket-transport.ts`, `socket-listener.ts` (0700 dir check,
  stale/in-use socket, 103-byte path guard, hello ≤ 1 KB / 5 s, constant-time
  token compare, 8 clients), `index.ts` (host lifecycle, settings, clipboard
  copy in bun), `client-config.ts`.
- **Bridge.** `src/mcp-bridge/main.ts`, `node:` imports only, bundled by
  `scripts/copy-bun-assets.ts` to `assets/bun/mcp-bridge.js` and copied to
  `bun/mcp-bridge.js`.
- **Tray.** `tray-active-template.png`; `trayMenu(status, agentLine)` and
  `LauncherController.setTrayActivity`.
- **Renderer.** Settings → Agents (MCP) view, exposed connections, client
  setup, token rotation, Activity (audit) view, footer activity status, browser
  stub and e2e `agents-settings.spec.ts`.

## Adaptations

- The app is now Conch: env `CONCH_MCP_TOKEN`, hello `{"conch":"hello"}`,
  server name `conch`, preview `conch_…abcd`, `~/.config/conch/run/mcp.sock`.
- `canAsk` is true whenever an AI provider is set: Mongo and Redis asks landed
  in plan 013, so they are no longer excluded.
- The Cursor config is the same JSON as "JSON"; the hint lives in the UI so
  the clipboard stays valid JSON.
- `claude mcp add conch --scope user -e CONCH_MCP_TOKEN=… -- <bun> <bridge> --socket <sock>`
  (flag order checked against `claude mcp add --help`).
- Workspace zod moved 4.3.6 → 4.6.7 in `bun.lock` (same `^4.1.13` range) so
  the SDK and the app share one zod; without it the tool schemas do not
  type-check.
- Every call shows activity from its start; it gains the connection name once
  resolved.

## Evidence

- `bun run check-types`: 15/15 workspaces pass.
- `packages/core` 591, `packages/rpc` 147, `packages/agent` 234 tests pass.
- App unit project for `src/bun` + `src/mcp-bridge`: 33 files, 325 tests
  pass (mcp-server 78 incl. a real Unix-socket listener, the stdio bridge
  spawned with `bun`, and a client → bridge → listener round trip).
- `bun run --cwd apps/app test`: 1,827 of 1,828 pass. The one failure,
  `ask-view` "running" snapshot, passes alone (18/18) and is in a view this
  change does not touch. The renderer run reported 95.75 % line coverage
  (96.24 % for `components/agents`).
- `bun run --cwd apps/app e2e`: 30 of 31 pass, including
  `agents-settings.spec.ts`. `refine-flow.spec.ts` fails on a selector older
  than the readable chip labels from 99fe377/943475c; untouched here.
- `bun run check`: one error, the `packages/rpc/src/index.ts` barrel-size rule
  (120 modules), which HEAD's index already trips.
- **Packaged build** (`desktop:build`, inner app extracted, scratch `HOME`,
  fixture Postgres): `Contents/Resources/app/bun/mcp-bridge.js` exists; the
  app logged `bridge …/Conch.app/Contents/Resources/app/bun/mcp-bridge.js via
…/Conch.app/Contents/MacOS/bun`; socket `srw-------` in `drwx------ run/`.
  An SDK client spawning that bun + bridge (the copied JSON config) listed the
  five tools (all `readOnlyHint`), saw only the exposed connection, got
  `NOT_FOUND` for the hidden one (`describe_schema` and `ask`), ran
  `run_widget` (2 rows) with the widget's `lastValues`/`lastRunAt` unchanged,
  got `INVALID_INPUT` for a bad option, and no output contained the host,
  password or token. The audit log held one entry per call, client "Claude
  Code", no rows. With agents off, no socket exists. After a hard kill the
  bridge prints "Conch is not running." and exits 1.

## Not verified

- `ask` against a real model (needs the owner's AI key); covered by tests
  with fake ports.
- Adding the copied config to Claude Code and calling from it; the SDK client
  above uses the same command, args and env.
- Rotation and relaunch inside the desktop app (bridge `open -g`), quit via the
  tray removing the socket, tray glyph and menu line while a call runs.
- Recordings at 1× and 0.25×, Safari Timelines, Reduce Motion / Transparency /
  Increase Contrast passes.
- App Translocation: a quarantined app run from Downloads gets a random
  read-only path, so the copied bridge path breaks. Move-to-Applications
  guidance is a follow-up.
- `/factory secure` pass before release (threat model in the plan).
