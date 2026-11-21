# SEC-002 attack path

- Severity: **medium**
- Policy decision: report and fix

## Path

1. There is an MSSQL connection, and either an exposed agent `ask`, an
   ordinary ask over prompt-injected data, or an imported bundle widget.
   An imported widget template needs no model at all.
2. The SQL is `SELECT … <statement>` with no `;`, so it passes `assertReadOnly`.
3. The MSSQL pool runs it inside a rolled-back transaction.
4. A non-transactional statement or an external read takes effect.

## Preconditions

A privileged login for `SHUTDOWN`. Ad hoc distributed queries or a linked
server for `OPENROWSET`/`OPENQUERY`.

## Counterevidence

The rollback wrapper defeats transactional writes, and many dangerous
statements are refused inside a transaction. That narrows the impact but does
not dispose of it.
