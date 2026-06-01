# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`compass-for-claude-code` ships a single CLI binary, `ccc`. Run it inside any project and it boots a local web dashboard to view/edit that project's Claude Code configuration — settings, skills, hooks, commands, agents, MCP servers, permissions, `CLAUDE.md`, and session history. It is a tool for inspecting *other* projects' Claude setups; the target project is whatever `cwd` `ccc` is launched in (overridable with `--cwd`).

## Commands

```bash
npm run dev        # server (tsx watch on :4180) + Vite dev server (:5180) via concurrently
npm run build      # build:web (Vite → dist/web) then build:server (tsup → dist/cli.js)
npm start          # run the built CLI (node bin/cli.js)
npm run typecheck  # tsc --noEmit
```

There is **no test suite** and no linter configured — `typecheck` is the only automated check.

During `dev`, open the Vite URL (`:5180`), not `:4180`. Vite proxies `/api` and the `/api/pty` WebSocket to the Hono server on `:4180` (see `src/web/vite.config.ts`), so the React app gets HMR while talking to the live backend.

## Architecture

Two halves built and bundled separately, served as one process in production:

- **Server** (`src/cli.ts` → `src/server/`): Commander CLI parses flags, picks a free port (4180+), then `startServer()` mounts a Hono app. Each feature is a route factory under `src/server/routes/` (e.g. `skillsRoute(ctx)`) mounted at `/api/<name>`. In production the same Hono app also serves the built SPA from `dist/web` with an index.html fallback for client-side routes.
- **Web** (`src/web/`): React 18 + React Router + Tailwind SPA, built by Vite into `dist/web`. One page component per route in `src/web/src/pages/`, matching the API routes. All HTTP goes through the thin `apiGet/apiPut/apiPost/apiDelete` helpers in `src/web/src/lib/api.ts` (base path `/api`).

`tsup` bundles the server to ESM with `node-pty` kept external (native addon) and a `createRequire` banner so CommonJS-only deps still load. `dist/web` must sit next to `dist/cli.js` — the CLI resolves the web dir as `resolve(__dirname, "web")`.

### Key cross-cutting concepts

- **`ServerContext` + `resolvePaths(cwd)`** (`src/server/lib/paths.ts`): every route is a factory taking `ctx` (`{ cwd, webDir }`). `resolvePaths` is the single source of truth for *where config lives* — project (`<cwd>/.claude/`, `<cwd>/CLAUDE.md`, `<cwd>/.mcp.json`) vs. user (`~/.claude/`). Most resources have both a **project** and **user** scope; route handlers take `:scope` as a param. Session history lives at `~/.claude/projects/<encoded-cwd>/` where the cwd is encoded by replacing `/` and `.` with `-` (`encodeProjectDir`).
- **The `claude` CLI is a backend dependency.** Several routes shell out to the user's installed `claude` binary rather than reimplementing its behavior: MCP CRUD runs `claude mcp add/list/get/remove` (`routes/mcp.ts`); `CLAUDE.md` generation streams `claude --print /init` over SSE (`routes/claudemd.ts`); auth detection runs `claude --print ok` (`lib/claude-bin.ts`). Auth status is cached for 5 min and de-duped across concurrent callers; `prewarmAuth()` fires on boot to overlap with browser load. Transient failures (timeouts) are deliberately *not* cached.
- **Embedded terminal** (`routes/pty.ts`): a `ws` WebSocket at `/api/pty` spawns a PTY via `node-pty` for the in-browser xterm.js terminal (used for `claude setup-token`). `node-pty` is imported lazily and degrades gracefully if no prebuilt binary exists for the platform.
- **Safe writes** (`src/server/lib/fs-safe.ts`): config edits should go through `writeWithBackup()`, which copies the existing file into `.claude/.compass-backups/` before an atomic temp-file rename. `readJsonSafe`/`readTextSafe` return `null` (never throw) on missing/invalid files. Delete handlers guard against path traversal by checking the resolved path stays under its scope root.

### Adding a feature

A new config surface typically means: a `src/server/routes/<x>.ts` route factory (mounted in `src/server/index.ts`), any new paths added to `resolvePaths`, a matching `src/web/src/pages/<X>.tsx` page, and a `NAV` entry in `src/web/src/App.tsx`.
