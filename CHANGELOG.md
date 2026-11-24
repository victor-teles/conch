# Changelog

What changed in each release of Conch, newest first.

## Unreleased

The first release of Conch as a database launcher. Earlier versions (0.0.x, named oh-my-query) were a different app, a tabbed SQL workspace, and do not update into this one.

### New

- One panel, summoned by a hotkey from any app. The hotkey needs no Accessibility permission.
- Ask a question in plain words and get a chart, a KPI or a table, with the SQL shown and run read-only.
- Refine an answer in place, drill into a segment, and see the assumptions the SQL made.
- `>` runs your own SQL read-only, `#` browses tables, `@` switches connection, and pasting an id or an email finds every table that holds it.
- Widgets: saved answers with typed inputs that run again without the AI.
- Boards: windows of widgets that refresh on a schedule.
- Watches: a widget's value in the menu bar, and a notification when it crosses a line you set.
- Agents: an opt-in, read-only MCP server for Claude Code, Cursor and other local agents.
- Sources: widgets that read from MCP tools and HTTP endpoints.
- Apps and write actions (experimental): small tools you describe, with every write confirmed.
- History of every question, themes you can edit, `conch://` links, and export and import of widgets and boards.
- A sample database for the first run.
- Conch updates itself.
- Send Feedback opens a GitHub issue with your version filled in.

### Engines

PostgreSQL, MySQL, SQLite, DuckDB, MongoDB and Redis. Microsoft SQL Server and ClickHouse are in beta.

### Removed

- The tabbed workspace, the editor, the result grid and the chat panel.
- Windows builds. Conch is macOS only for now.
