# Discovery: 20261121-repo

Scope: repository, prioritising the read-only SQL contract (guard + every
driver's `readOnly` path) and the Agents (MCP) local interface. 24 files
reviewed in full (see `work-ledger.jsonl`); renderer sinks were searched
repository-wide (`dangerouslySetInnerHTML`, `innerHTML`, `href`,
`window.open`, `openExternal`).

| ID      | Candidate                                                    | Family                        |
| ------- | ------------------------------------------------------------ | ----------------------------- |
| SEC-001 | DuckDB read-only execution reads local files and remote URLs | confused deputy / file read   |
| SEC-002 | T-SQL batches bypass the single-statement guard              | injection / broken control    |
| SEC-003 | `openExternal` RPC opens any URL                             | dangerous sink without source |
| SEC-004 | Chart `<style>` built with `dangerouslySetInnerHTML`         | XSS/CSS injection             |
| SEC-005 | MCP client cap exceeded by concurrent handshakes             | TOCTOU, availability          |

Not pursued (coverage limits): driver internals beyond the read-only path,
updater signature handling (Electrobun), Redis command allow-list depth,
ClickHouse table functions under `readonly=1` (needs a running server).
