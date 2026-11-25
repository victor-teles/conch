# Contributing to Conch

Thanks for helping. This page covers what you need to send a change that can be merged.

## Before you start

- **A bug:** open an issue with the Conch version, the database engine and the steps. The launcher's **Send Feedback** command fills in the version for you.
- **A feature:** open an issue first and describe what you want to do with it. Conch is one panel and a few windows on purpose, so some ideas will not fit, and it is better to find that out before you write code.
- **A security problem:** follow [SECURITY.md](SECURITY.md). Do not open a public issue.

## Set up

You need macOS 14 or later, [Bun](https://bun.sh) 1.4.4 and the Xcode command line tools (`xcode-select --install`).

```bash
bun install
bun run dev:web                        # the renderer in a browser, with recorded answers
bun run --cwd apps/app desktop:dev     # the real desktop app
```

`dev:web` is the fastest way to work on the interface: it needs no database and no AI key. Use `desktop:dev` for anything that touches windows, the hotkey, the tray or a real database.

Driver tests can run against real databases. `bun run fixtures:up` starts the PostgreSQL fixture; the other engines are in `infra/docker-compose.yaml`.

## Make the change

- Work on a branch, not on `main`.
- Write tests for new code, next to the file: `*.test.ts` for logic, `*.browser.test.tsx` for components and hooks.
- Keep to the existing structure. [CLAUDE.md](CLAUDE.md) describes the architecture, the conventions and where things live. It is written for coding agents, and it is the most complete map of the code for people too.
- No comments that restate the code. Comment only a reason that is not obvious.

## Check it

While you work, run only what covers your change:

```bash
bun run check-types
bun run --cwd apps/app test:unit <path>
bun run --cwd apps/app test:browser <path>
```

Before you open the pull request, run everything once:

```bash
bun run check                    # lint and format
bun run check-types
bun run --cwd apps/app test
```

CI runs the same checks, plus coverage (80% of lines) and the Playwright flows.

## Changes that need extra care

- **Contracts in `packages/rpc`** (`CardSpec`, `AskEvent`, `Widget`, `Source`, actions, themes) are stored on users' disks. Changing one needs a version bump and an upgrade path for old records.
- **The read-only guard and the write guard** (`packages/agent`). A change here needs tests that show what is refused, not only what passes.
- **Anything that opens a URL, runs a command or writes to a database.** Explain in the pull request who can trigger it and what stops misuse.

## Pull requests

Say what changed for the user and why, then how you tested it. Add a screenshot or a short recording for anything visible. Small pull requests get reviewed faster.

By contributing, you agree that your work is released under the [MIT license](LICENSE).
