# Compass for Claude Code — User Guide

A walkthrough of every menu in the `ccc` dashboard: what it is, why it exists, how to
use it, what it changes on disk, and — importantly — **how *not* to use it**, because
many of these pages write real files that Claude Code reads on every run. A bad edit
here can silently break a project's Claude setup.

> **Two scopes everywhere.** Most pages have a **Project** scope (`<cwd>/.claude/`,
> `<cwd>/CLAUDE.md`, `<cwd>/.mcp.json`) and a **User** scope (`~/.claude/`). Project
> scope affects only the current project; User scope affects *every* project you open
> with Claude Code. Always confirm which tab you're on before saving.
>
> **Backups.** Edits to `settings.json`, hooks, and permissions are written through a
> safe-write path that first copies the existing file into
> `.claude/.compass-backups/`, then does an atomic replace. If you break something, the
> previous version is in that folder.

---

## I · Dashboard

**What it is.** The landing page — a read-only survey of the current project's Claude
setup.

**Why / purpose.** One glance to answer "is this project wired up correctly, and what's
here?" It shows counts (Skills, Commands, Agents, MCP Servers, Sessions), a CLAUDE.md
preview, recent sessions, and a "Setup health" row of green/red dots
(`.claude/`, `CLAUDE.md`, `.mcp.json`, `settings.json`, history, login).

**How to use.** Read it. Click any KPI card or quick-action button to jump to the
matching page. "Generate CLAUDE.md" / "View CLAUDE.md" adapts to whether the file exists.

**Impact.** None — it only reads.

**How *not* to use.** Don't treat a red health dot as an error to "fix" blindly — a
missing `.mcp.json` or `CLAUDE.md` is perfectly normal for many projects. Red means
"absent," not "broken."

---

## II · CLAUDE.md

**What it is.** Viewer/editor/generator for the project's `CLAUDE.md` — the instruction
file Claude Code reads on **every** run in this project.

**Why / purpose.** This is the single highest-leverage file for steering Claude's
behavior in a repo (conventions, commands, architecture notes, do/don't rules).

**How to use.**
- **View** — read the rendered file.
- **Edit** — opens a textarea; **Save** writes the file.
- **Generate / Regenerate** — runs `claude --print /init` and streams the output live.
  This asks the real Claude CLI to inspect the repo and author a CLAUDE.md.
- **Start blank** — opens an editor seeded with a minimal header.

**Impact.** Save and Generate both overwrite `<cwd>/CLAUDE.md`. Whatever ends up here is
injected into Claude's context for all future runs in this project.

**How *not* to use.**
- **Regenerate overwrites.** The confirmation dialog says so — running `/init` on a
  project that already has a curated CLAUDE.md will **replace** it wholesale. Copy your
  hand-written content out first if you value it.
- Don't paste secrets, tokens, or credentials here — this file is read into context and
  is usually committed to git.
- Don't bloat it. Every line costs context budget on every run. Keep it to durable,
  high-signal rules; transient notes belong elsewhere.

---

## III · Settings

**What it is.** A raw JSON editor for `settings.json` across four targets:
Project (`<cwd>/.claude/settings.json`), Project·local
(`settings.local.json`), User (`~/.claude/settings.json`), and User·local.

**Why / purpose.** Direct control over the full settings file — model, env vars,
permissions, hooks, status line, and anything else Claude Code supports. The `.local`
variants are for machine-specific overrides you typically `.gitignore`.

**How to use.** Pick a tab, edit the JSON, **Save**. If a file doesn't exist yet, the
page says "save to create." The editor validates JSON before saving and refuses invalid
JSON.

**Impact.** Replaces the whole file (after a backup). These settings change how Claude
Code behaves in this project (or globally, for User scope).

**How *not* to use.**
- **This is the whole file, not a patch.** If you delete a key here, it's gone. Don't
  paste a fragment over a full config.
- Don't hand-edit the `hooks` or `permissions` blocks here unless you know the schema —
  the dedicated **Hooks**, **Permissions**, and **Tools** pages exist precisely so you
  don't have to. Use those for safer, structured edits.
- Project·local vs Project matters: secrets and personal overrides go in `.local`
  (gitignored), shared team config goes in the committed `settings.json`. Putting an API
  key in the committed file leaks it.
- Invalid JSON is rejected on save, but **semantically** wrong keys are not — a
  misspelled setting name is silently ignored by Claude Code.

---

## IV · Skills

**What it is.** CRUD for Skills — `*/.claude/skills/<name>/SKILL.md`. Each skill is a
folder with a `SKILL.md` (frontmatter `name` + `description`, then a body of
instructions) that Claude can invoke on demand.

**Why / purpose.** Skills are reusable, model-invoked capabilities: a named bundle of
instructions (and optionally scripts) Claude pulls in when relevant. Good for encoding a
repeatable procedure once.

**How to use.**
- **+ New skill** → name + scope → creates a templated `SKILL.md`.
- Pick a skill from the Project/User lists to load its `SKILL.md` into the editor → edit
  → **Save**.
- **Delete** removes the skill (confirmation prompt).

**Impact.** Writes/deletes files under `.claude/skills/`. A skill's `description` is what
Claude uses to decide *when* to invoke it.

**How *not* to use.**
- The `description:` frontmatter is not decoration — it's the trigger. A vague or empty
  description (the template ships `TODO`) means Claude never knows when to use the skill.
  Write a precise "use this when…" description.
- A "no SKILL.md" badge means the folder exists without the required file — that skill is
  inert until you create the file.
- **Delete is permanent** (no backup for skill folders). Don't delete a skill you didn't
  create without checking what's inside — it may be plugin-managed or shared.
- Don't put project-specific skills in **User** scope (they'd load in every project) or
  vice-versa.

---

## V · Hooks

**What it is.** A JSON editor for the `hooks` block inside `settings.json` (Project or
User scope). See the **full hooks reference** below.

**Why / purpose.** Hooks let *the harness* (not Claude) run your shell commands
automatically at defined lifecycle moments — e.g., run a formatter after every edit,
block edits to protected files, inject context when you submit a prompt. This is the only
way to get deterministic, always-runs automation; Claude's memory/preferences can't
guarantee it.

**How to use.** Edit the JSON, **Save** (backed up first). Structure:

```json
{
  "PreToolUse": [
    {
      "matcher": "Edit|Write",
      "hooks": [
        { "type": "command", "command": "./scripts/guard.sh" }
      ]
    }
  ]
}
```

**Impact.** These commands run **automatically on your machine** with your shell and
permissions, triggered by Claude Code events. A hook that exits non-zero on `PreToolUse`
can block the tool call.

**How *not* to use.**
- **Hooks execute arbitrary shell automatically.** Never paste a hook command you don't
  understand — it runs with your privileges, unattended, every time the event fires.
- Slow or hanging commands stall the session — every triggered hook runs synchronously.
  Keep them fast; background long work yourself.
- A wrong `matcher` either never fires or fires on everything. `matcher` is matched
  against tool names (e.g. `Bash`, `Edit`, `Write`, `Read`); an empty/missing matcher
  matches all tools for that event.
- The editor only validates JSON, not hook semantics — a malformed hook entry is accepted
  by the file but ignored (or errors) at runtime.
- Don't reference scripts by relative path unless you're sure of the working directory;
  prefer absolute paths or paths relative to the project root you control.

### Full hooks reference — every event type

Each event takes an array of matcher-groups; each group has a `matcher` (for tool-scoped
events) and a list of `hooks` (`{ "type": "command", "command": "..." }`). Hooks receive
JSON about the event on **stdin** and can influence flow via **exit code** (non-zero =
block, where supported) or structured JSON on stdout.

| Event | Fires when | Why / typical use | Can block? |
|---|---|---|---|
| **PreToolUse** | Right before Claude runs any tool (Bash, Edit, Write, etc.). `matcher` selects which tools. | Guardrails: block edits to protected paths, deny dangerous Bash, require a clean tree before writes, auto-approve known-safe calls. | **Yes** — non-zero exit / deny verdict cancels the call. |
| **PostToolUse** | Right after a tool finishes successfully. | Reactions: auto-format or lint a file after Edit/Write, run tests after a change, log what was touched. | No (the tool already ran) — but can surface feedback to Claude. |
| **UserPromptSubmit** | When you submit a prompt, before Claude sees it. | Inject extra context (ticket info, current branch, house rules), or block prompts that violate policy. | **Yes** — can reject the prompt; stdout can prepend context. |
| **Notification** | When Claude Code raises a notification (needs permission, has gone idle waiting on you). | Desktop/Slack pings so you don't miss a permission prompt or an idle agent. | No. |
| **Stop** | When the main agent finishes its response (turn ends). | "Done" notifications, post-turn cleanup, auto-commit, kick off a follow-up. | **Yes** — can force the agent to continue instead of stopping. |
| **SubagentStop** | When a subagent (a `Task`/Agent run) finishes. | Same as Stop but for spawned subagents — aggregate results, notify, gate completion. | **Yes** — can keep the subagent going. |
| **PreCompact** | Before Claude Code compacts (summarizes) the conversation context. | Persist state you don't want lost in summarization; log/snapshot before context is collapsed. | No (advisory). |
| **SessionStart** | When a session starts or resumes. | Seed environment context, print a project banner, warm caches, load secrets into env. | No. |
| **SessionEnd** | When a session ends. | Teardown, flush logs, final notification, cleanup temp files. | No. |

**When/why to choose each:**
- Want to **prevent** something → `PreToolUse` (tools) or `UserPromptSubmit` (prompts).
- Want to **react** to something that happened → `PostToolUse`, `Stop`, `SubagentStop`,
  `SessionEnd`.
- Want to **get notified** → `Notification`, `Stop`.
- Want to **inject context** → `UserPromptSubmit`, `SessionStart`.
- Want to **save state before loss** → `PreCompact`.

**Hook safety rules (read before adding any):**
1. The command runs automatically with your shell privileges — treat it like a cron job
   you're installing.
2. Blocking hooks (`PreToolUse`, `UserPromptSubmit`, `Stop`) can deadlock your workflow
   if they always fail — test the command standalone first.
3. Keep them quick; they run inline with the session.
4. User-scope hooks run in **every** project. Only put truly universal hooks there.

---

## VI · Commands

**What it is.** CRUD for slash commands — `*/.claude/commands/<name>.md`. Each markdown
file becomes a `/name` command.

**Why / purpose.** Commands are user-invoked prompt templates: type `/name` and the
file's body is sent as the instruction. Great for repeatable asks ("review this PR",
"write a changelog entry").

**How to use.** **+ New command** (name + scope) creates a templated `.md`; pick one to
edit its body; **Save**; **Delete** to remove. The frontmatter `description` shows up in
the command picker.

**Impact.** Writes/deletes `.claude/commands/<name>.md`. The file body **is** the prompt
that runs when you invoke the command.

**How *not* to use.**
- The file body is literally injected as a prompt — don't leave the placeholder text, or
  `/yourcommand` will just tell Claude to "Describe what this slash command does."
- Naming collides by precedence: a project command and a user command with the same name
  can shadow each other. Keep names distinct and descriptive.
- Delete is permanent (no backup). Don't remove commands shipped by a plugin.

---

## VII · Agents

**What it is.** CRUD for custom subagents — `*/.claude/agents/<name>.md`. Frontmatter
declares `name`, `description`, allowed `tools`, and `model`; the body is the agent's
system prompt.

**Why / purpose.** Custom agents are specialized workers Claude can delegate to (via the
Task tool). You constrain their tools and pick a model, then describe their behavior.
Useful for focused, repeatable roles (e.g., a code-reviewer or a test-writer).

**How to use.** **+ New agent** seeds a template with `tools: [Read, Edit]` and a model.
Edit the frontmatter + system-prompt body. **Save** / **Delete**.

**Impact.** Writes/deletes `.claude/agents/<name>.md`. The `description` controls when
Claude auto-delegates to this agent; `tools` limits what it can do; `model` sets cost/speed.

**How *not* to use.**
- The `tools:` list is a security/scoping boundary — granting `Bash` or `Write` to an
  agent that doesn't need them widens what an auto-invoked agent can do. Grant the
  minimum.
- `model:` must be a valid model ID (the template uses `claude-sonnet-4-6`). A typo here
  means the agent fails to spawn or falls back unexpectedly.
- A weak `description` causes Claude to either never use the agent or misuse it. Be
  explicit about when it applies.
- Don't duplicate a built-in agent's role with a vague custom one; you'll get
  unpredictable delegation.

---

## VIII · MCP Servers

**What it is.** Manager for Model Context Protocol servers, driven by the real
`claude mcp add/list/get/remove` CLI (not direct file writes).

**Why / purpose.** MCP servers give Claude extra tools/data sources (filesystem, GitHub,
databases, custom APIs). This page adds, lists, and removes them without you memorizing
the CLI flags.

**How to use.** **+ Add server** → name, transport (`stdio` / `http` / `sse`), scope
(`user` / `project` / `local`), then either a command + args (stdio) or a URL
(http/sse), plus optional `KEY=value` env vars. **Remove** deletes a server.

**Impact.** Runs the `claude mcp` CLI, which writes to the appropriate config
(`.mcp.json` for project scope, user config for user scope). Configured servers are
launched by Claude Code and expose tools to the model.

**How *not* to use.**
- **stdio servers run a local command** every session — only add servers/commands you
  trust. A malicious MCP command runs on your machine.
- Env vars here often hold **secrets** (API keys). At `project` scope these land in
  `.mcp.json`, which is frequently committed — prefer `user` or `local` scope for
  anything sensitive, and check whether `.mcp.json` is gitignored.
- Wrong transport ↔ field mix fails silently-ish: `stdio` needs command+args; `http`/`sse`
  need a URL. Don't fill both.
- Removing a server that a **plugin** bundles may be re-added or break that plugin —
  manage plugin MCP via the Plugins page.

---

## IX · Permissions

**What it is.** A guided editor for the `permissions` block of `settings.json`, per scope.
Each rule is a single row carrying exactly one verdict — Allow, Ask, or Deny — so the same
pattern can never sit in two lists at once.

**Why / purpose.** Controls which tool calls run without prompting, which prompt you
first, and which are blocked outright. Patterns look like `Bash(git *)`, `Edit`, or
`mcp__server`.

**How to use.** Pick scope. Use **Add a rule** to compose a pattern: choose a tool from the
dropdown, optionally fill the contextual match field (e.g. `git *` for Bash), pick a verdict,
**Add** — a live preview shows the resulting pattern. Or hit a **Quick add** preset. Flip a
rule's verdict with its Allow/Ask/Deny toggle, or remove it with 🗑. Adding a pattern that
already exists just changes its verdict instead of duplicating it. Then **Save**.

If a loaded file already lists the same pattern under multiple verdicts, the strictest wins
(deny > ask > allow) and a notice invites you to Save the cleaned-up version.

**Advanced (raw).** Toggle to **Advanced** for the classic three textareas (one pattern per
line) when you want to paste or bulk-edit patterns directly. Edits round-trip back to the
guided view.

**Impact.** Rewrites `permissions.allow/ask/deny`. **Precedence: deny > ask > allow.**
This directly governs what Claude can do unattended.

**How *not* to use.**
- **Allow is a loaded gun.** `Bash(*)` or a bare `Bash` in Allow lets Claude run *any*
  shell command with no prompt. Scope allow-patterns tightly (`Bash(npm run *)`,
  `Bash(git status)`).
- Because deny wins, an over-broad **Deny** can silently block legitimate work — if "why
  won't Claude run X" puzzles you, check Deny first.
- Pattern syntax matters: `Bash(git *)` (with the glob) ≠ `Bash(git)`. A malformed
  pattern simply never matches, giving a false sense of safety.
- User-scope allow-rules apply to **every** project. Don't globally allow destructive
  commands.

---

## X · History

**What it is.** A read-only browser of past Claude sessions for this project, read from
`~/.claude/projects/<encoded-cwd>/`.

**Why / purpose.** Review what happened in prior runs — first prompt, event count,
timestamps, and the full event stream (JSON) of any session. Good for auditing,
debugging, or recalling a past conversation.

**How to use.** Search/filter by id or prompt, click a session to load its events, scroll
the event list. Each event is shown as truncated JSON.

**Impact.** None — read-only.

**How *not* to use.** Nothing destructive is possible here, but note session logs can
contain **whatever was discussed**, including any secrets you pasted into past sessions —
be mindful if screen-sharing this page.

---

## XI · Plugins

**What it is.** Manager for Claude Code plugins and plugin marketplaces, driven by the
`claude plugin` CLI.

**Why / purpose.** Plugins bundle commands, agents, skills, and MCP servers from a
marketplace (a GitHub repo or URL). This page installs/uninstalls/enables/disables/
updates plugins and adds/removes the marketplaces they come from.

**How to use.**
- Add a **marketplace** first (e.g. `anthropics/claude-plugins-official`), pick scope.
- **Install plugin** using `plugin@marketplace` syntax.
- Per plugin: **Enable/Disable**, **Update** (pull latest), **Uninstall**.
- Per marketplace: **Update**, **Remove**.

**Impact.** Runs the `claude plugin` CLI, which downloads code and registers its
commands/agents/skills/MCP servers. Installed plugins can contribute **executable** MCP
servers and hooks.

**How *not* to use.**
- A plugin is third-party code that can add MCP servers and commands — **only install
  from marketplaces you trust.** Treat it like installing an npm package.
- **Removing a marketplace** can orphan plugins installed from it. Uninstall the plugins
  first, or expect them to break.
- Disabling vs uninstalling: disable keeps it installed (toggle back on later);
  uninstall removes it. Don't uninstall to "temporarily" turn something off.
- Scope (`user`/`project`/`local`) decides where it's active — a user-scope plugin loads
  everywhere.

---

## XII · Tools

**What it is.** A quick-toggle UI over the *same* permissions data as the Permissions
page, but presented per built-in tool with Allow / Ask / Deny / Default buttons.

**Why / purpose.** A friendlier way to set a verdict for a whole tool (e.g., set `Bash`
to Ask) without writing pattern syntax. It shows the current effective verdict in both
project and user scope.

**How to use.** Pick scope, filter the tool list, click Allow/Ask/Deny/Default for a
tool. "Default" removes it from allow/ask/deny (falls back to Claude Code's default).
Changes save immediately.

**Impact.** Writes the **bare tool name** into `permissions.allow/ask/deny` for the
chosen scope — same file the Permissions page edits. Precedence is still deny > ask >
allow.

**How *not* to use.**
- **This toggles the whole tool, not a sub-pattern.** Setting `Bash` to Allow here allows
  *all* Bash. For granular rules like `Bash(git *)` or `mcp__server`, use the Permissions
  page — the on-page note says exactly this.
- It edits the same keys as Permissions; toggling here can override a carefully-crafted
  pattern you set there (and vice-versa). Pick one mental model per tool.
- "Default" is not "Deny" — it removes the rule entirely, letting Claude Code's built-in
  default decide. Don't confuse the two.

---

## XIII · Files

**What it is.** A read-only file browser of the project tree, with a click-to-read pane.

**Why / purpose.** Inspect the project's files (and its `.claude/` config) without
leaving the dashboard. Lazy-loads directories on expand.

**How to use.** Expand folders in the tree, click a file to view it with line numbers.
Binary files and files over 2 MB are not previewed.

**Impact.** None — read-only. It does not edit or delete.

**How *not* to use.** It's a viewer, not an editor — don't expect to change files here.
For config edits use the dedicated pages.

---

## XIV · Git Status

**What it is.** A read-only view of the working tree against the current branch — staged
vs. unstaged/untracked files, with per-file diffs.

**Why / purpose.** See what's changed before you commit, and read the actual diffs,
without switching to a terminal. Badges mark Added/Modified/Deleted/Renamed/etc., with
+/− line counts.

**How to use.** Click a file to load its diff (untracked files show their full body).
**Refresh** re-reads status. Binary/oversized diffs are hidden.

**Impact.** None — it only reads git state. It does **not** stage, commit, push, or
discard anything.

**How *not* to use.** Don't expect git actions here — there are no commit/stage/discard
buttons by design. Use your terminal or Claude for those.

---

## Setup (secondary page)

Reached via the sidebar "Setup required" link or the auth badge — not a numbered chapter.
It handles installing/verifying the `claude` CLI and login (including an embedded
terminal for `claude setup-token`). Use it when the dashboard reports the CLI is missing
or login failed. Don't paste login tokens anywhere but the intended flow.

---

## Cross-cutting "don'ts" (the short list)

1. **Check the scope tab.** User scope changes every project, not just this one.
2. **Whole-file editors replace, not patch** (Settings, Hooks). Don't paste fragments.
3. **Allow/Tools verdicts and MCP/Plugins run real code** with your privileges — only
   allow/install what you trust.
4. **Secrets** don't belong in committed files (`CLAUDE.md`, project `settings.json`,
   project-scope `.mcp.json`). Use `.local` / `user` scope and check gitignore.
5. **Deletes on Skills/Commands/Agents are permanent** (no backup) — settings/hooks/
   permissions are backed up to `.claude/.compass-backups/`.
6. **JSON validity ≠ semantic validity** — a well-formed but misspelled key is silently
   ignored by Claude Code.
</content>
</invoke>
