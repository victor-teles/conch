<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/logo-dark.png" />
  <source media="(prefers-color-scheme: light)" srcset=".github/logo-light.png" />
  <img src=".github/logo-light.png" alt="Conch" width="360" />
</picture>

<br />

Conch, the database launcher. Ask your database a question without leaving what you're doing.

[![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat)](LICENSE)
[![macOS](https://img.shields.io/badge/platform-macOS-000000.svg?style=flat&logo=apple&logoColor=white)](https://github.com/victor-teles/conch/releases)
[![Electrobun](https://img.shields.io/badge/Electrobun-2-FBF0DF.svg?style=flat&logo=bun&logoColor=black)](https://electrobun.dev)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?style=flat&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

</div>

<br />

> [!NOTE]
> Conch is in beta. It is used daily, but details still change between releases. [Tell us what breaks](https://github.com/victor-teles/conch/issues/new).

<br />

Conch is a database launcher for macOS. Press a hotkey, ask a question in plain words, and get a chart or a table from your own database. It works with eight database engines and is built for the keyboard.

A conch is the shell you blow to call people together, and whoever holds it gets to speak. Conch works the same way: one hotkey calls the panel, and then you ask.

<br />

## Features

### One panel, summoned by a hotkey

Press `Option + Shift + Space` from any app to open the launcher. It shows your recent answers, saved widgets, boards and connections. Press `Esc` and the focus goes back to the app you were using. The app lives in the menu bar and has no Dock icon. The hotkey needs no Accessibility permission.

### Ask, and see the answer

Type a question and press `Enter`. The panel shows the SQL as it is written, runs it read-only, and turns the result into a chart, a KPI or a table. Statements that change data are refused before they run. The AI reads your schema and works with **OpenAI**, **Anthropic**, **OpenRouter** and **local models** through Ollama or any OpenAI-compatible endpoint.

No AI key yet? Type `>` to run your own SQL read-only, or `#` to browse tables. Both work without a model.

### Widgets: answers you keep

Save an answer as a widget with typed inputs: a region, a date range, a limit. Running a widget again uses the saved SQL and does not call the AI. Input values always go to the database as bind parameters, never as SQL text.

### Boards: widgets that stay on screen

A board is a separate window with a grid of widgets that refreshes on a schedule you choose. Inputs that widgets share, such as the same date range, appear once at the top of the board. When you change one, only the tiles that use it run again. Boards pause their refresh while they are hidden or minimized.

### Agents: a safe door for Claude Code and Cursor

Conch can serve the connections you choose to local agents over MCP. It is off until you turn it on, read-only, and agents never see your credentials or write SQL themselves: they ask questions and run your saved widgets through the same guard the launcher uses. Every call is listed in an audit log.

### Apps: small tools you describe

Type what you need, such as "a refund desk: failed charges next to their orders, with a Refund button", and choose **Build an app**. The panel assembles as it is written: inputs, cards that read from your databases, MCP tools or HTTP endpoints, and actions. Press `Cmd + S` to review it. Every action that changes data needs your tick, the target's **Allow write actions** setting and a system confirmation before it is saved. A saved app opens in its own window and runs on fresh data each time without calling the AI; a write still asks you to confirm in the launcher every time it runs. Apps and write actions are experimental.

### Eight database engines, one client

Connect to **PostgreSQL**, **MySQL**, **SQLite**, **DuckDB**, **MongoDB** and **Redis**, plus **Microsoft SQL Server** and **ClickHouse** in beta.

### Native experience

Built with Electrobun. A translucent panel, dark mode by default, themes you can edit, spring animations that you can interrupt, and full support for `prefers-reduced-motion`.

<br />

## Install

Conch runs on macOS 14 or later, on Apple Silicon and Intel.

Download the latest `.dmg` from the [Releases](https://github.com/victor-teles/conch/releases) page, open it and drag Conch to Applications. Conch updates itself after that.

Once the first stable version is out, Homebrew works too:

```bash
brew install --cask victor-teles/tap/conch
```

### First run

With no database added yet, the launcher offers **Try the Sample Database**. It creates a small store on your Mac (customers, products and a year of orders) with three widgets, so you can look around before you connect anything of your own.

<br />

## What leaves your Mac

- **Your credentials never do.** Connections and the AI key are encrypted on disk in `~/.config/conch`. Nothing uploads them, and the AI never sees them.
- **When you ask a question**, the AI provider you chose receives the question, the names and types of your tables and columns, the SQL it wrote, and up to 20 rows of the result so it can title and draw the answer. Turn on PII redaction for a connection to mask values that look personal before they are sent. With a local model through Ollama, none of this leaves your Mac.
- **Everything else stays local.** Widgets, boards, raw SQL, table browsing and id lookups never call the AI.
- **No analytics.** Conch sends no usage data. Apart from your databases and the AI provider you chose, it contacts only GitHub, to check for updates, unless you add an MCP server or an HTTP endpoint yourself.

See [SECURITY.md](SECURITY.md) for how the read-only guarantee is enforced and how to report a problem.

<br />

## Keyboard Shortcuts

### Launcher

| Shortcut                 | Action                                             |
| ------------------------ | -------------------------------------------------- |
| `Option + Shift + Space` | Open or close the launcher (change it in Settings) |
| `Up` / `Down`            | Move through the list                              |
| `Enter`                  | Ask, run the widget, or open the board             |
| `Tab`                    | Edit a widget's inputs before it runs              |
| `Cmd + K`                | Actions for the selected row                       |
| `Cmd + Y`                | Search every past question                         |
| `>` / `#` / `@`          | Run SQL, browse tables, switch connection          |
| `Cmd + ,`                | Settings                                           |
| `Esc`                    | Go back, clear the field, then close               |

### Answers

| Shortcut          | Action                            |
| ----------------- | --------------------------------- |
| `Enter`           | Refine the answer in place        |
| `Cmd + number`    | Switch between the answer's views |
| `Cmd + E`         | Show or hide the SQL              |
| `Cmd + C`         | Copy the SQL                      |
| `Cmd + S`         | Save as a widget                  |
| `Cmd + Shift + S` | Save as a widget with inputs      |
| `Esc`             | Stop a running answer             |

### Boards

| Shortcut                  | Action                                              |
| ------------------------- | --------------------------------------------------- |
| `Cmd + R`                 | Refresh every tile                                  |
| `Cmd + E`                 | Enter or leave edit mode                            |
| `Option + Left` / `Right` | Move the focused tile (edit mode)                   |
| `Option + Up` / `Down`    | Make the focused tile larger or smaller (edit mode) |
| `Esc`                     | Leave edit mode                                     |

### Apps

| Shortcut          | Action                                                 |
| ----------------- | ------------------------------------------------------ |
| `Cmd + S`         | Review and save the app you just built (launcher)      |
| `Cmd + R`         | Run every source again                                 |
| `Cmd + E`         | Enter or leave edit mode (cards move like board tiles) |
| `Cmd + Shift + E` | Change the app with a prompt                           |
| `Esc`             | Discard a change in progress, or leave edit mode       |

<br />

## Development

### Prerequisites

- [Bun](https://bun.sh) v1.4.4+
- Xcode command line tools (`xcode-select --install`), for the small native hotkey helper

### Getting started

```bash
# Install dependencies
bun install

# Start the renderer only (browser, with recorded answers)
bun run dev:web

# Start the desktop app (Vite + Electrobun watcher)
bun run --cwd apps/app desktop:dev
```

The renderer runs at [localhost:3001](http://localhost:3001).

### Other commands

```bash
bun run build          # Build all packages
bun run check-types    # TypeScript across all workspaces
bun run check          # Lint + format check (Ultracite)
bun run fix            # Auto-fix lint/format
bun run --cwd apps/app test           # Vitest, unit and browser projects
bun run --cwd apps/app test:coverage  # Vitest with the 80% line gate
bun run --cwd apps/app e2e            # Playwright against the Vite dev server
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to work on Conch and [RELEASING.md](RELEASING.md) for how a version ships.

<br />

## Project Structure

```
conch/
├── apps/
│   ├── app/                       # Electrobun desktop app
│   │   ├── src/
│   │   │   ├── mainview/          # React renderer (launcher, boards, apps)
│   │   │   ├── bun/               # Bun-side process (windows, RPC, services)
│   │   │   └── mcp-bridge/        # stdio bridge that agents spawn
│   │   ├── native/                # macOS hotkey helper (C)
│   │   └── electrobun.config.ts
│   └── video/                     # Remotion product videos
├── packages/
│   ├── agent/                     # AI ask pipeline and SQL guards (runs in bun)
│   ├── core/                      # Persistence, encryption, SQL tooling
│   ├── drivers/                   # Driver registry and read paths
│   ├── drivers-*/                 # One package per database engine
│   ├── rpc/                       # Contracts shared by renderer and bun
│   ├── env/                       # Type-safe environment variables
│   └── config/                    # Shared TypeScript config
├── turbo.json
└── package.json
```

<br />

## Tech Stack

**Frontend** — React 19, TanStack Router, Tailwind CSS v4, shadcn/ui, Motion, Recharts

**Desktop** — Electrobun, Bun runtime, Vercel AI SDK, TypeScript drivers for PostgreSQL/MySQL/SQLite/SQL Server/DuckDB/ClickHouse/MongoDB/Redis, polyglot-sql

**Tooling** — Turborepo, Bun, TypeScript 5, Vitest, Playwright, Ultracite (Oxlint + Oxfmt)

<br />

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first; it is short.

<br />

## License

[MIT](LICENSE)
