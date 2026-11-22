# Conch threat model

Repository scope. Written 2026-11-21 at `5a36121`.

## Overview

Conch is a single-user macOS desktop SQL/AI client: a Raycast-style launcher
(React renderer in an Electrobun webview) over a bun process that owns every
database pool, the encrypted stores in `~/.config/conch` and the AI ask
pipeline. Users store connection credentials (AES-GCM, key in
`~/.config/conch/.key`, mode 0600), run their own SQL, ask questions an AI model
turns into read-only SQL, save widgets, share widget/board bundles, and (plan 016) expose chosen connections to local AI agents over MCP.

## Threat model, trust boundaries and assumptions

| Boundary                                               | Trusted side        | Untrusted side                                                                                       |
| ------------------------------------------------------ | ------------------- | ---------------------------------------------------------------------------------------------------- |
| Renderer ↔ bun RPC (`src/bun/rpc.ts`)                  | Conch's own UI code | Content it renders: DB rows, AI output, imported bundles                                             |
| Bun ↔ databases (`packages/drivers-*`)                 | Conch               | Data inside the databases (may be attacker-written)                                                  |
| Bun ↔ AI provider (`packages/agent`)                   | Conch               | Model output (SQL, card specs), steerable by prompt injection in data or questions                   |
| Bun ↔ MCP clients (`src/bun/mcp-server/`, Unix socket) | The app's policy    | Local agents: they may be prompt-injected and are meant to reach only exposed connections, read-only |
| Bundle import (`bundle-service.ts`)                    | Conch               | `.conch.json` files from other people                                                                |
| Local filesystem                                       | The user            | Other macOS users; same-user malware is out of scope                                                 |

Assumptions: the machine's user is trusted; other local users are not; any
process of the same user can already read `~/.config/conch` (documented in the
Agents settings help text). The AI model and MCP agents are _not_ trusted to
stay inside policy.

## Attack surface, mitigations and attacker stories

- **AI-written and imported SQL.** Read-only is enforced twice: `assertReadOnly`
  (`packages/agent/src/read-only-guard.ts`: single statement, allow-listed
  leading keyword, forbidden words, two lexers) and `Pool.execute(..., {
readOnly: true })` per driver (Postgres/MySQL/DuckDB read-only transactions,
  ClickHouse `readonly=1`, SQLite read-only, MSSQL rolled-back transaction).
  Mongo/Redis use allow-listed plans. Story: poisoned rows or a hostile bundle
  make a query that reads outside the database or changes state.
- **MCP server.** Opt-in, 0700 dir + 0600 socket, per-install token
  (`timingSafeEqual`), exposure checked per call, row/cell/payload caps, PII
  redaction, secret scrubbing, audit. Story: an agent (or text injected into
  it) uses Conch as a confused deputy to reach unexposed connections, stored
  credentials or local files.
- **Renderer.** React escaping; no data reaches `innerHTML`; chart CSS keys are
  synthetic. Story: XSS from DB/AI content gains the full RPC surface.
- **Bundles.** zod-parsed, size-capped, imported widgets go through
  `saveWidget` guards; connections are `{name,type}` refs only.

## Severity calibration

- **Critical:** remote or cross-user code execution; another macOS user
  reading stored credentials.
- **High:** an untrusted input (agent, AI output, bundle, DB data) reading
  local files or stored credentials, writing to a user database, or reaching
  an unexposed connection. Example: AI-written read-only SQL that returns
  `~/.config/conch/.key`.
- **Medium:** untrusted input causing server-side effects the read-only
  contract forbids but that need extra preconditions (privileged login,
  non-default server settings), or reading server-side files.
- **Low:** availability issues bounded by timeouts, information that is
  already reachable by design (rows of an exposed connection).
- **Out of scope:** same-user malware, a user running their own SQL in the
  editor, data the user deliberately exposed.
