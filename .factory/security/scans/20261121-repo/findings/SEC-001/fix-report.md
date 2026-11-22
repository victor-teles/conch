# SEC-001 fix

- **Control:** `packages/drivers-duckdb/src/read-only-sources.ts`,
  `assertReadsOwnTables`, called inside the read-only transaction in
  `DuckdbPool.execute` (`packages/drivers-duckdb/src/pool.ts:117`).
- **How it checks:** it parses the statement with DuckDB's own parser
  (`json_serialize_sql`, SQL passed as a bound parameter) and rejects
  `NOT_READ_ONLY` when it finds:
  - any table function other than `range`, `generate_series` or `unnest`;
  - a `FROM` source that is a quoted path;
  - more than one statement;
  - anything that is not a SELECT.
- **Parser errors** pass through, and running the statement fails with the
  same syntax error.
- **Why here:** the driver is the single read-only boundary for asks, MCP
  tools, widgets, imported widgets and lookups, so one control covers every
  sibling path. Using DuckDB's own parser means there is no parser
  differential.
- **Unchanged:** non-read-only execution (the user's own SQL editor) still
  reads files.
- **Tests:** `packages/drivers-duckdb/src/read-only.test.ts`, 8 new cases.
  - A canary file is refused through `read_text`, `read_blob`, a quoted path, a
    CTE, a scalar subquery and `query()`.
  - More than one statement is refused.
  - Legitimate reads, `range()` and `SHOW TABLES` still run, and syntax errors
    are kept.
  - The user's direct file read still works.
