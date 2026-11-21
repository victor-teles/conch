# Security scan 20261121-repo

Commit `5a36121`, 2026-11-21. Mode: `secure` (audit and fix). Scope: the
repository, with priority on the read-only SQL contract and the Agents (MCP)
local interface. Inspected sequentially, without independent reviewers.

## Executive summary

Two findings were reportable, one high and one medium. Both are fixed in
source and covered by regression tests.

Both break the same promise: SQL that Conch runs "read-only" for an untrusted
author stays inside the database. The untrusted authors are the AI model,
local agents and imported bundles. Before the fix, DuckDB's read-only mode
still let that SQL read any local file. On SQL Server, a single SELECT could
carry a second statement past the guard.

| #       | Title                                                        | Severity | Status |
| ------- | ------------------------------------------------------------ | -------- | ------ |
| SEC-001 | DuckDB read-only execution reads local files and remote URLs | High     | Fixed  |
| SEC-002 | T-SQL batches bypass the single-statement guard              | Medium   | Fixed  |

## Threat model summary

Conch is a single-user desktop client. It holds encrypted credentials for many
databases and runs SQL written by untrusted authors: the AI model (steerable by
data or questions), local MCP agents, and bundles from other people. All of it
runs under a read-only contract enforced twice: by `assertReadOnly`, and by
each driver's `readOnly` execution. Other local users and the content Conch
renders are untrusted; same-user malware is out of scope. The full model is in
`threat-model.md`.

## Findings

| #       | Title                                                        | Severity | Evidence                                                                         | Impact                                                                        | Remediation                                                                                              |
| ------- | ------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| SEC-001 | DuckDB read-only execution reads local files and remote URLs | High     | PoC: guard returned ok, and the read-only pool returned a canary file's contents | Any user-readable file, including the Conch key and the encrypted credentials | DuckDB-parser check on read-only execution: no file/network table functions, no path sources, one SELECT |
| SEC-002 | T-SQL batches bypass the single-statement guard              | Medium   | Unit tests: 7 semicolon-free batches passed the old guard                        | Non-transactional server effects and external reads on MSSQL                  | T-SQL reserved statement words forbidden in the guard                                                    |

### SEC-001: DuckDB read-only execution reads local files and remote URLs

- **Affected code:**
  - `packages/drivers-duckdb/src/pool.ts:117`: read-only execution
  - `packages/agent/src/read-only-guard.ts:271`: guard
  - `apps/app/src/bun/mcp-server/tools.ts:257`: MCP `ask`
  - `apps/app/src/bun/widget-service.ts:254`: widget runs
- **Root cause:** read-only mode was `BEGIN TRANSACTION READ ONLY`, and the
  guard has no rule for table functions. `read_text`, `read_blob`, `read_csv`,
  `query()`, `httpfs` readers and quoted paths in `FROM` all ran.
- **Attack:** an exposed DuckDB connection plus an agent question, or an
  imported widget, reads `~/.config/conch/.key` and `connections.json` from
  the Conch process.
- **Fix:** `packages/drivers-duckdb/src/read-only-sources.ts` checks the
  statement with DuckDB's own parser before running it. Only `range`,
  `generate_series` and `unnest` remain as table functions, and the user's own
  editor SQL is unchanged.
- **Evidence:** the original PoC reproduces as tests in
  `packages/drivers-duckdb/src/read-only.test.ts`, which now refuse it.

### SEC-002: T-SQL batches bypass the single-statement guard

- **Affected code:**
  - `packages/agent/src/read-only-guard.ts:251`: guard
  - `packages/drivers-mssql/src/pool.ts:263`: rollback wrapper
- **Root cause:** "no `;` means one statement" does not hold for T-SQL. The
  MSSQL read-only mode is a rolled-back transaction, which does not contain
  `SHUTDOWN`, `OPENROWSET`/`OPENQUERY` reads or long `WAITFOR`s.
- **Preconditions:** a privileged login or non-default server features.
- **Fix:** for `tsql`, the guard forbids the reserved words that start those
  statements. Valid T-SQL can't use them as unquoted identifiers.
- **Evidence:** the server-side effect was not run against SQL Server; see
  `findings/SEC-002/validation.md`.

## Suppressed and not applicable

- **SEC-003, `openExternal` opens any URL:** not applicable. It has no caller
  and no attacker source reaches it. If a caller is added, restrict it to
  `https:`.
- **SEC-004, chart `<style>` built with `dangerouslySetInnerHTML`:**
  suppressed. Keys and colors are synthetic, never data.
- **SEC-005, MCP client cap race:** not applicable. It affects availability
  only and needs the token.

## Deferred and coverage limits

- ClickHouse table functions (`url()`, `file()`) under `readonly=1`: needs a
  running server.
- SQL Server execution of SEC-002 payloads.
- Redis allow-list depth.
- Electrobun updater verification.
- Driver internals outside the read-only path.

## Verification

- `packages/drivers-duckdb`: 77 tests pass, 8 of them new.
- `packages/agent`: 243 tests pass, 9 of them new.
- `packages/core`: 591 tests pass.
- `packages/drivers`: 10 tests pass.
- `bun run check-types`: 15/15.
- `bun run check`: 0 errors.
- `bun run --cwd apps/app test`: 209 files, 1828 tests pass.
