# compass-for-claude-code

[![npm version](https://img.shields.io/npm/v/compass-for-claude-code.svg)](https://www.npmjs.com/package/compass-for-claude-code)
[![npm downloads](https://img.shields.io/npm/dm/compass-for-claude-code.svg)](https://www.npmjs.com/package/compass-for-claude-code)
[![node](https://img.shields.io/node/v/compass-for-claude-code.svg)](https://www.npmjs.com/package/compass-for-claude-code)
[![license](https://img.shields.io/npm/l/compass-for-claude-code.svg)](LICENSE)

> A local web dashboard for every Claude Code project — inspect and edit settings, skills, hooks, commands, agents, MCP servers, permissions, `CLAUDE.md`, and session history from one UI.

Install once, run `ccc` inside any project, and a browser tab opens onto a unified dashboard for that project's [Claude Code](https://claude.ai/code) configuration. Compass is a tool for *inspecting and managing other projects' Claude setups* — the target project is whatever directory you launch `ccc` in.

## Features

- **Dashboard** — at-a-glance project + Claude CLI status, resource counts, and a setup-health view
- **Setup** — install/login guidance with an embedded terminal for `claude setup-token`
- **CLAUDE.md** — view, edit, or generate from a prompt using your local `claude --print /init` (streamed live)
- **Settings** — edit project (`.claude/settings.json`) and user (`~/.claude/settings.json`)
- **Skills · Hooks · Commands · Agents** — full CRUD at both project and user scope
- **MCP servers** — list, add, and remove (shells out to `claude mcp`)
- **Permissions** — manage tool allow/deny lists with patterns
- **Plugins · Tools · Files** — browse plugins, available tools, and project files
- **Git** — current working-tree status for the project
- **History** — browse past Claude sessions for the current project in a threaded view

Most resources have both a **project** scope (`<cwd>/.claude/`, `<cwd>/CLAUDE.md`, `<cwd>/.mcp.json`) and a **user** scope (`~/.claude/`). Project scope affects only the current project; user scope affects every project you open with Claude Code.

> Edits to `settings.json`, hooks, and permissions are written through a safe-write path that first copies the existing file into `.claude/.compass-backups/`, then does an atomic replace — so a bad edit is always recoverable.

## Requirements

- **Node.js >= 20**
- The [`claude` CLI](https://claude.ai/code) installed and on your `PATH`. Several features (MCP CRUD, `CLAUDE.md` generation, auth detection) shell out to it. Compass still runs without it, but those features will be unavailable.

## Install

```bash
npm i -g compass-for-claude-code
```

## Usage

```bash
cd your-project
ccc
```

Opens `http://localhost:<port>` in your default browser (first free port from 4180).

### Flags

| Flag | Description |
| --- | --- |
| `-p, --port <number>` | Bind a specific port (default: first free from 4180) |
| `--no-open` | Don't open the browser automatically |
| `-c, --cwd <path>` | Scope to a different project directory (default: current directory) |
| `-V, --version` | Print the version |
| `-h, --help` | Show help |

## How it works

Compass is two halves bundled into one process:

- **Server** (`src/server/`) — a [Hono](https://hono.dev) app started by a Commander CLI. Each feature is a route factory mounted under `/api/<name>`. In production it also serves the built SPA.
- **Web** (`src/web/`) — a React 18 + React Router + Tailwind SPA built by Vite, with one page per API route.

The `claude` CLI is treated as a backend dependency: MCP CRUD runs `claude mcp …`, `CLAUDE.md` generation streams `claude --print /init` over SSE, and auth detection runs `claude --print ok`. An embedded xterm.js terminal (via `node-pty`) powers in-browser flows like `claude setup-token`.

For a page-by-page walkthrough — including what each page writes to disk and how *not* to use it — see [`docs/GUIDE.md`](docs/GUIDE.md).

## Development

```bash
npm install
npm run dev        # Hono server (tsx watch on :4180) + Vite dev server (:5180)
```

Open the **Vite URL (`:5180`)**, not `:4180`. Vite proxies `/api` and the `/api/pty` WebSocket to the Hono server, so the React app gets HMR while talking to the live backend.

```bash
npm run build      # build:web (Vite → dist/web) then build:server (tsup → dist/cli.js)
npm start          # run the built CLI
npm run typecheck  # tsc --noEmit (the only automated check — there is no test suite yet)
```

## Contributing

Contributions are welcome! A typical new config surface means:

1. A `src/server/routes/<x>.ts` route factory, mounted in `src/server/index.ts`
2. Any new paths added to `resolvePaths` in `src/server/lib/paths.ts`
3. A matching `src/web/src/pages/<X>.tsx` page
4. A `NAV` entry in `src/web/src/App.tsx`

Before opening a PR, run `npm run typecheck` and `npm run build` to confirm both halves compile. Keep new code in the style of the surrounding files.

If you find a bug or have a feature idea, please [open an issue](https://github.com/codeXForger/compass-for-claude-code/issues).

## License

[MIT](LICENSE) © compass-for-claude-code contributors
