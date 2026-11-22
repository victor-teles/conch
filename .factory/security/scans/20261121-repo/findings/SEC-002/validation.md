# SEC-002 validation: T-SQL batches bypass the single-statement guard

- Confidence: high for the guard bypass; medium for server-side impact
- Method: focused unit tests against `assertReadOnly`, plus a code trace of
  the MSSQL driver; no SQL Server instance was available

## Evidence criteria

1. The guard accepts a SELECT followed by a second, semicolon-free T-SQL
   statement: **met**. Seven cases passed the old guard, among them
   `select 1 shutdown`, `… kill 52`, `… restore database …`, `… dbcc …`,
   `… disable trigger …`, `… waitfor delay …` and `openrowset(bulk …)`.
2. The driver executes the batch as more than one statement: **met by code
   trace and T-SQL semantics** (statement terminators are optional).
   `inRolledBackTransaction` wraps the text in `BEGIN TRANSACTION … ROLLBACK`,
   which undoes transactional writes but not `SHUTDOWN`. It also does not stop
   external reads through `OPENROWSET`/`OPENQUERY` or delays.

## Disposition

reportable

## Proof gaps

Not run against SQL Server: which statements SQL Server refuses inside a user
transaction (BACKUP/RESTORE/RECONFIGURE are documented as refused).
