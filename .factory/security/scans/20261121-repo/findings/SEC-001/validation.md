# SEC-001 validation: DuckDB read-only execution reads local files

- Confidence: high
- Method: PoC through the real guard and the real driver, then regression tests

## Evidence criteria

1. `assertReadOnly` accepts a query that reads a file: **met**.
2. `DuckdbPool.execute(..., { readOnly: true })` returns the file contents: **met**.
3. The path is reachable from an untrusted source: **met by code trace**. The
   MCP `ask` tool runs model SQL through `buildAskPorts` (`readOnly: true`);
   widgets (including imported bundles) run through `runReadOnly`.

## Evidence

A canary file in the scratchpad was read with
`SELECT content FROM read_text('<canary path>')`: the guard returned
`{"ok":true}` and the read-only pool returned the canary line. Nested forms
(CTE, scalar subquery), `read_blob`, a quoted path in `FROM` and
`query('…')` dynamic SQL take the same path.

## Disposition

reportable

## Proof gaps

Remote egress through DuckDB's auto-loaded `httpfs` was not exercised (no
network test); it is the same table-function family and is blocked by the fix.
