# SEC-002 fix

- **Control:** `packages/agent/src/read-only-guard.ts`. For the `tsql`
  dialect it adds these words to the forbidden list:
  - statements that can't be rolled back: `backup`, `restore`, `shutdown`,
    `kill`, `dbcc`, `reconfigure`, `checkpoint`;
  - long delays: `waitfor`;
  - permission and text changes: `deny`, `writetext`, `updatetext`;
  - batch and control words: `bulk`, `declare`, `begin`,
    `disable/enable trigger`;
  - external reads: `openrowset`, `opendatasource`, `openquery`.
- **No false positives in valid T-SQL:** these are reserved words, so they
  can't appear unquoted as identifiers. Bracketed column names such as
  `[backup]` are still stripped as identifiers.
- **Tests:** `packages/agent/src/read-only-guard.test.ts`.
  - 7 new rejected cases.
  - 2 new allowed cases: `OFFSET … FETCH NEXT` paging, and bracketed
    statement words used as column names.
