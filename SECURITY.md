# Security

Conch holds credentials for your databases and runs SQL that an AI model wrote. This page says what it promises, how the promises are kept, and how to report a problem.

## Report a vulnerability

Use [Report a vulnerability](https://github.com/victor-teles/conch/security/advisories/new) on GitHub. The report is private. Please do not open a public issue for a security problem.

Include the Conch version (Settings → About), the database engine, and the smallest steps that show the problem. Conch has one maintainer, so allow a few days for a reply.

Only the latest release gets security fixes while Conch is in beta.

## What Conch promises

1. **Questions and widgets never change your data.** SQL written by the AI, by a local agent or by an imported file runs read-only.
2. **A write only runs when you confirm it.** Write actions are off for every connection until you switch them on, and each run shows the exact call and waits for your confirmation.
3. **Your credentials stay on your Mac.** They are encrypted on disk, and the AI and local agents never receive them.
4. **Agents reach only what you expose.** The MCP server is off by default, exposes no connection until you choose one, and takes no SQL from an agent.

## How they are kept

- **Read-only, enforced twice.** A guard refuses anything but a single read statement before it runs (`packages/agent/src/read-only-guard.ts`). Then each driver runs the statement in the engine's own read-only mode: a read-only transaction on PostgreSQL, MySQL and DuckDB, `readonly=1` on ClickHouse, a read-only handle on SQLite and a rolled-back transaction on SQL Server. MongoDB and Redis run only allow-listed read operations.
- **Values are never SQL.** Widget inputs travel as bind parameters.
- **Writes go through one path.** A write is compiled in the bun process, tied to a single-use token that expires after two minutes, checked against a write guard, run in a transaction with a row limit, and recorded in a hash-chained log you can read in Activity.
- **Storage.** `~/.config/conch` holds connections, the AI key and saved work, encrypted with AES-GCM. The key file is readable by your user only.
- **Agents.** The MCP server listens on a Unix socket in a private directory, never on a network port. Each client presents a token, every call is checked against what you exposed, results are capped and can be redacted, and errors have host names, users and passwords removed.

## Out of scope

- Other software running as your macOS user. It can already read your files, including `~/.config/conch`.
- SQL you type yourself with `>`. It still runs read-only.
- Data you chose to expose to an agent.

## Known limits

- SQL Server and ClickHouse are in beta: their guards are tested, but not yet against a live server of every version.
- With a hosted AI provider, the question, your schema's table and column names and up to 20 result rows are sent to that provider. Use a local model if that is not acceptable for a database.
