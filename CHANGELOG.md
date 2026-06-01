# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-06-02

### Added

- **Guided Permissions editor** — the Permissions page is now a single list where each
  rule carries exactly one verdict (Allow / Ask / Deny) via a toggle, making it
  structurally impossible to put the same pattern in two lists. A guided **Add a rule**
  builder composes patterns from a plain-English tool picker with a contextual match
  field and a live preview; **Quick add** presets cover common cases; and the list has
  **search** plus **Allow/Ask/Deny filter** chips. If a loaded `settings.json` lists a
  pattern under multiple verdicts, the strictest wins (deny > ask > allow) and a notice
  invites a clean-up save. An **Advanced (raw)** toggle keeps the original three-textarea
  editor for power users, round-tripping with the guided view.
- **Format & polish for CLAUDE.md** — a magic-wand button in the CLAUDE.md /
  CLAUDE.local.md editor sends the current draft to the local `claude` CLI, which
  rephrases it and reformats it into clean Markdown (headings, lists, code fences,
  spacing). The result is shown as a side-by-side **Before / After** diff with
  **Apply** / **Discard**, so nothing changes until you accept it.
- **Readable conversation history** — the History page now renders past sessions as
  a plain-language conversation (You / Claude) instead of raw JSON. Tool steps show
  as collapsible plain-language rows ("Ran a command", "Read a file", "Searched the
  code") that expand to the exact input and result, and internal events are filtered
  out. A **Raw** toggle keeps the original JSON view one click away.
- **Project name indicator** — the target project's name is shown in the sidebar (on
  every page, with the full path on hover) and in the Files page header, so multiple
  `ccc` instances are easy to tell apart.

### Changed

- **History layout** — the session list and detail pane are now independently
  scrollable within the viewport instead of growing the whole page.
- **Session list** — timestamps show as relative time ("2 hours ago", exact time on
  hover).
- Dropped the "Atlas" wording from the sidebar and loading screen; branding is now
  simply **Compass for Claude Code**.

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
