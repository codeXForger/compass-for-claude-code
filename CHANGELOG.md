# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-06-01

Initial release.

### Added

- **`ccc` CLI** — boots a local web dashboard for the Claude Code configuration
  of whatever project it is launched in (`--cwd` to target another directory).
- **Dashboard** — project + `claude` CLI status, resource counts, setup health.
- **Setup** — install/login guidance with an embedded xterm.js terminal (via
  `node-pty`) for `claude setup-token`.
- **CLAUDE.md** — view, edit, or generate from `claude --print /init` (streamed
  over SSE), plus a personal **`CLAUDE.local.md`** editor.
- **Settings, Skills, Hooks, Commands, Agents** — CRUD at project and user scope.
- **MCP servers** — list, add, and remove (shells out to `claude mcp`).
- **Permissions, Tools, Plugins, Files, Git, History** — view/manage tool
  allow-deny lists, browse plugins/tools/files, project git status, and past
  sessions.
- **Rephrase with Claude** — one-click rewrite of description and body fields on
  the Commands, Agents, and Skills pages, via the local `claude` CLI.
- **Native "local" scope** — Hooks, Permissions, Tools, and CLAUDE.md support a
  project-personal scope written to `.claude/settings.local.json` /
  `CLAUDE.local.md`, auto-added to `.gitignore` so it is never committed.
- **Safe writes** — config edits are backed up to `.claude/.compass-backups/`
  before an atomic replace, so a bad edit is always recoverable.

[Unreleased]: https://github.com/codeXForger/compass-for-claude-code/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/codeXForger/compass-for-claude-code/releases/tag/v0.1.0
