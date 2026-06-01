import type { ReactNode } from "react";

/**
 * In-app guide content for each dashboard page. Condensed from docs/GUIDE.md so the
 * drawer stays scannable. Keyed by route pathname (see App.tsx <Route path>).
 */
export interface Guide {
  /** Short page name, e.g. "Hooks". */
  title: string;
  /** One-line "what it is" summary shown under the title. */
  tagline: string;
  what: string;
  why: string;
  /** Steps / bullets for how to use the page. */
  howToUse: string[];
  /** What changes on disk / in Claude Code when you act here. */
  impact: string;
  /** The "don'ts" — rendered with a warning accent. */
  howNotToUse: string[];
  /** Optional rich block rendered after the sections (e.g. the Hooks table). */
  extra?: ReactNode;
}

export type GuideMap = Record<string, Guide>;

/** The 9 Claude Code hook event types — rendered inside the Hooks guide. */
function HooksTable(): ReactNode {
  const rows: { event: string; fires: string; why: string; block: "Yes" | "No" }[] = [
    {
      event: "PreToolUse",
      fires: "Before Claude runs any tool (matcher selects which).",
      why: "Guardrails: block edits to protected paths, deny dangerous Bash, auto-approve safe calls.",
      block: "Yes",
    },
    {
      event: "PostToolUse",
      fires: "After a tool finishes successfully.",
      why: "React: auto-format/lint after Edit/Write, run tests, log what changed.",
      block: "No",
    },
    {
      event: "UserPromptSubmit",
      fires: "When you submit a prompt, before Claude sees it.",
      why: "Inject context (branch, ticket, rules) or block disallowed prompts.",
      block: "Yes",
    },
    {
      event: "Notification",
      fires: "When Claude Code raises a notification (needs permission / idle).",
      why: "Desktop or Slack pings so you don't miss a prompt.",
      block: "No",
    },
    {
      event: "Stop",
      fires: "When the main agent finishes its turn.",
      why: "Done notifications, auto-commit, cleanup, or force a follow-up.",
      block: "Yes",
    },
    {
      event: "SubagentStop",
      fires: "When a spawned subagent (Task) finishes.",
      why: "Aggregate results, notify, or keep the subagent going.",
      block: "Yes",
    },
    {
      event: "PreCompact",
      fires: "Before Claude compacts (summarizes) the conversation.",
      why: "Persist state you don't want lost in summarization.",
      block: "No",
    },
    {
      event: "SessionStart",
      fires: "When a session starts or resumes.",
      why: "Seed env context, print a banner, warm caches.",
      block: "No",
    },
    {
      event: "SessionEnd",
      fires: "When a session ends.",
      why: "Teardown, flush logs, final notification.",
      block: "No",
    },
  ];

  return (
    <div>
      <div className="mb-2 eyebrow">Every hook event type</div>
      <div className="card-flat overflow-hidden">
        <table className="w-full text-left text-[11.5px]">
          <thead>
            <tr className="border-b border-rule text-faint">
              <th className="px-3 py-2 font-medium">Event</th>
              <th className="px-3 py-2 font-medium">Fires when · why</th>
              <th className="px-3 py-2 font-medium">Block?</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.event} className="border-b border-rule/60 align-top last:border-0">
                <td className="px-3 py-2">
                  <code className="font-mono text-[11px] text-ink">{r.event}</code>
                </td>
                <td className="px-3 py-2 text-muted">
                  <div className="text-ink">{r.fires}</div>
                  <div className="mt-0.5 text-faint">{r.why}</div>
                </td>
                <td className="px-3 py-2">
                  {r.block === "Yes" ? (
                    <span className="pill-sage text-[10px]">
                      <span className="dot bg-sage" /> Yes
                    </span>
                  ) : (
                    <span className="pill-quiet text-[10px]">
                      <span className="dot bg-faint" /> No
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11.5px] text-muted">
        Prevent something → <code className="font-mono text-ink">PreToolUse</code> /{" "}
        <code className="font-mono text-ink">UserPromptSubmit</code>. React →{" "}
        <code className="font-mono text-ink">PostToolUse</code> /{" "}
        <code className="font-mono text-ink">Stop</code>. Get notified →{" "}
        <code className="font-mono text-ink">Notification</code>. Inject context →{" "}
        <code className="font-mono text-ink">SessionStart</code>. Save before loss →{" "}
        <code className="font-mono text-ink">PreCompact</code>.
      </p>
    </div>
  );
}

export const GUIDES: GuideMap = {
  "/": {
    title: "Dashboard",
    tagline: "A read-only survey of this project's Claude setup.",
    what: "The landing page: counts of Skills, Commands, Agents, MCP Servers and Sessions, a CLAUDE.md preview, recent sessions, and a Setup-health row of green/red dots.",
    why: "One glance to answer 'is this project wired up correctly, and what's here?'",
    howToUse: [
      "Read it — nothing here writes.",
      "Click any KPI card or quick-action to jump to that page.",
      "'Generate / View CLAUDE.md' adapts to whether the file exists.",
    ],
    impact: "None — it only reads the project's config.",
    howNotToUse: [
      "A red health dot means 'absent', not 'broken'. A missing .mcp.json or CLAUDE.md is normal for many projects — don't 'fix' it blindly.",
    ],
  },
  "/claudemd": {
    title: "CLAUDE.md",
    tagline: "Instructions Claude reads on every run in this project.",
    what: "Viewer, editor, and generator for the project's CLAUDE.md — conventions, commands, architecture notes, and do/don't rules.",
    why: "The single highest-leverage file for steering Claude's behavior in a repo.",
    howToUse: [
      "View to read it; Edit to open the textarea, then Save.",
      "Generate / Regenerate runs `claude --print /init` and streams the output live.",
      "Start blank opens an editor seeded with a minimal header.",
    ],
    impact: "Save and Generate overwrite <cwd>/CLAUDE.md. Its contents are injected into Claude's context for all future runs in this project.",
    howNotToUse: [
      "Regenerate OVERWRITES an existing curated CLAUDE.md wholesale — copy hand-written content out first.",
      "Don't paste secrets/tokens here — this file is read into context and usually committed to git.",
      "Don't bloat it. Every line costs context budget on every run; keep it high-signal.",
    ],
  },
  "/settings": {
    title: "Settings",
    tagline: "Raw JSON editor for settings.json at four targets.",
    what: "Edits Project, Project·local, User, and User·local settings.json — model, env vars, permissions, hooks, status line, and more.",
    why: "Direct control over the full settings file. The .local variants hold machine-specific overrides you typically gitignore.",
    howToUse: [
      "Pick a tab, edit the JSON, Save. If a file doesn't exist, it says 'save to create'.",
      "Invalid JSON is rejected before saving.",
    ],
    impact: "Replaces the whole file (after a backup to .claude/.compass-backups/). Changes how Claude Code behaves in this project — or globally, for User scope.",
    howNotToUse: [
      "This is the WHOLE file, not a patch. Delete a key here and it's gone — don't paste a fragment over a full config.",
      "Prefer the Hooks / Permissions / Tools pages over hand-editing those blocks here.",
      "Secrets and personal overrides go in .local (gitignored), not the committed settings.json.",
      "JSON validity ≠ semantic validity — a misspelled key is silently ignored by Claude Code.",
    ],
  },
  "/skills": {
    title: "Skills",
    tagline: "Reusable, model-invoked capabilities (SKILL.md).",
    what: "CRUD for .claude/skills/<name>/SKILL.md — a named bundle of instructions Claude pulls in when relevant.",
    why: "Encode a repeatable procedure once; Claude invokes it on demand based on its description.",
    howToUse: [
      "+ New skill → name + scope → creates a templated SKILL.md.",
      "Pick a skill to load its SKILL.md into the editor, then Save.",
      "Delete removes the skill (with confirmation).",
    ],
    impact: "Writes/deletes files under .claude/skills/. The description frontmatter is what Claude uses to decide WHEN to invoke the skill.",
    howNotToUse: [
      "The description is the trigger, not decoration. Leaving it as 'TODO' means Claude never knows when to use the skill.",
      "A 'no SKILL.md' badge means the skill is inert until you create the file.",
      "Delete is permanent (no backup) — don't delete skills you didn't create; they may be plugin-managed.",
      "Don't put project-specific skills in User scope (they'd load everywhere) or vice-versa.",
    ],
  },
  "/hooks": {
    title: "Hooks",
    tagline: "Shell commands the harness runs automatically at lifecycle events.",
    what: "A JSON editor for the `hooks` block inside settings.json (Project or User scope).",
    why: "The only way to get deterministic, always-runs automation — format after every edit, block edits to protected files, inject context on prompt submit. Claude's memory can't guarantee this; the harness runs hooks.",
    howToUse: [
      "Edit the JSON and Save (backed up first).",
      "Each event takes matcher-groups: a `matcher` (tool name like Bash|Edit) and a list of { type: 'command', command: '…' }.",
      "See the event-type reference below to pick the right event.",
    ],
    impact: "These commands run AUTOMATICALLY on your machine with your shell and privileges, triggered by Claude Code events. A non-zero exit on a blocking event can cancel the action.",
    howNotToUse: [
      "Hooks execute arbitrary shell automatically — never paste a command you don't understand.",
      "Slow/hanging commands stall the session; every hook runs synchronously. Keep them fast.",
      "A wrong matcher either never fires or fires on everything. Empty matcher = all tools.",
      "User-scope hooks run in EVERY project — only put truly universal hooks there.",
      "The editor validates JSON only, not hook semantics — a malformed entry is silently ignored at runtime.",
    ],
    extra: <HooksTable />,
  },
  "/commands": {
    title: "Commands",
    tagline: "User-invoked slash-command prompt templates.",
    what: "CRUD for .claude/commands/<name>.md. Each file becomes a /name command whose body is sent as the instruction.",
    why: "Repeatable asks ('review this PR', 'write a changelog entry') you trigger by typing /name.",
    howToUse: [
      "+ New command (name + scope) creates a templated .md.",
      "Pick one to edit its body, then Save.",
      "The frontmatter description shows up in the command picker.",
    ],
    impact: "Writes/deletes .claude/commands/<name>.md. The file body IS the prompt that runs when you invoke the command.",
    howNotToUse: [
      "Don't leave the placeholder text — /yourcommand would just tell Claude to 'Describe what this slash command does.'",
      "Project and user commands with the same name shadow each other — keep names distinct.",
      "Delete is permanent (no backup); don't remove commands shipped by a plugin.",
    ],
  },
  "/agents": {
    title: "Agents",
    tagline: "Specialized subagents Claude can delegate to.",
    what: "CRUD for .claude/agents/<name>.md. Frontmatter declares name, description, allowed tools, and model; the body is the agent's system prompt.",
    why: "Focused, repeatable roles (code-reviewer, test-writer) with constrained tools and a chosen model.",
    howToUse: [
      "+ New agent seeds a template with tools: [Read, Edit] and a model.",
      "Edit the frontmatter + system-prompt body, then Save.",
    ],
    impact: "Writes/deletes .claude/agents/<name>.md. `description` controls auto-delegation; `tools` limits what it can do; `model` sets cost/speed.",
    howNotToUse: [
      "The tools list is a scoping boundary — granting Bash or Write to an auto-invoked agent widens what it can do. Grant the minimum.",
      "model must be a valid model ID (template uses claude-sonnet-4-6); a typo breaks spawning.",
      "A weak description means Claude never uses the agent, or misuses it. Be explicit about when it applies.",
    ],
  },
  "/mcp": {
    title: "MCP Servers",
    tagline: "Extra tools/data sources for Claude, via `claude mcp`.",
    what: "Add, list, and remove Model Context Protocol servers (filesystem, GitHub, databases, custom APIs). Driven by the real claude mcp CLI.",
    why: "Give Claude capabilities beyond its built-in tools without memorizing CLI flags.",
    howToUse: [
      "+ Add server → name, transport (stdio / http / sse), scope (user / project / local).",
      "stdio needs a command + args; http/sse need a URL. Add optional KEY=value env vars.",
      "Remove deletes a server.",
    ],
    impact: "Runs the claude mcp CLI, which writes .mcp.json (project) or user config. Configured servers are launched by Claude Code and expose tools to the model.",
    howNotToUse: [
      "stdio servers run a local command every session — only add servers you trust.",
      "Env vars often hold secrets. At project scope they land in .mcp.json (often committed) — prefer user/local scope and check gitignore.",
      "Don't fill both command+args and URL — match the transport.",
      "Removing a plugin-bundled server may break that plugin; manage those via Plugins.",
    ],
  },
  "/permissions": {
    title: "Permissions",
    tagline: "Allow / Ask / Deny patterns for tool calls.",
    what: "A three-column editor for the permissions block of settings.json, per scope. One pattern per line (e.g. Bash(git *), Edit, mcp__server).",
    why: "Controls which tool calls run unattended, which prompt first, and which are blocked.",
    howToUse: [
      "Pick scope, type patterns into Allow / Ask / Deny (one per line), Save.",
      "Precedence: deny > ask > allow.",
    ],
    impact: "Rewrites permissions.allow/ask/deny. Directly governs what Claude can do without asking you.",
    howNotToUse: [
      "Allow is a loaded gun — `Bash(*)` or bare `Bash` lets Claude run ANY shell command with no prompt. Scope tightly.",
      "Because deny wins, an over-broad Deny silently blocks legitimate work. Check Deny first when 'why won't Claude run X'.",
      "Pattern syntax matters: Bash(git *) ≠ Bash(git). A malformed pattern simply never matches.",
      "User-scope allow-rules apply to every project — don't globally allow destructive commands.",
    ],
  },
  "/history": {
    title: "History",
    tagline: "A read-only log of past Claude sessions for this project.",
    what: "Browses sessions from ~/.claude/projects/<encoded-cwd>/ — first prompt, event count, timestamps, and the full JSON event stream of any session.",
    why: "Audit, debug, or recall a past conversation.",
    howToUse: [
      "Search/filter by id or prompt.",
      "Click a session to load its events and scroll the stream.",
    ],
    impact: "None — read-only.",
    howNotToUse: [
      "Session logs contain whatever was discussed, including secrets pasted into past sessions — be mindful when screen-sharing.",
    ],
  },
  "/plugins": {
    title: "Plugins",
    tagline: "Bundles of commands/agents/skills/MCP from a marketplace.",
    what: "Manager for Claude Code plugins and the marketplaces (GitHub repos/URLs) they come from. Driven by the claude plugin CLI.",
    why: "Install third-party bundles of capabilities in one step.",
    howToUse: [
      "Add a marketplace first (e.g. anthropics/claude-plugins-official), pick scope.",
      "Install plugin using plugin@marketplace syntax.",
      "Per plugin: Enable/Disable, Update, Uninstall. Per marketplace: Update, Remove.",
    ],
    impact: "Runs the claude plugin CLI, which downloads code and registers its commands/agents/skills/MCP servers. Plugins can contribute executable MCP servers and hooks.",
    howNotToUse: [
      "A plugin is third-party code that can add MCP servers — only install from marketplaces you trust.",
      "Removing a marketplace can orphan plugins installed from it — uninstall those first.",
      "Disable keeps it installed; Uninstall removes it. Don't uninstall to 'temporarily' turn something off.",
      "A user-scope plugin loads in every project.",
    ],
  },
  "/tools": {
    title: "Tools",
    tagline: "Quick Allow/Ask/Deny toggles per built-in tool.",
    what: "A friendlier view over the same permissions data as the Permissions page, with one-click verdict buttons per tool and the current verdict in both scopes.",
    why: "Set a verdict for a whole tool (e.g. Bash → Ask) without writing pattern syntax.",
    howToUse: [
      "Pick scope, filter the tool list, click Allow / Ask / Deny / Default.",
      "Default removes the tool from allow/ask/deny (falls back to Claude Code's default). Changes save immediately.",
    ],
    impact: "Writes the bare tool name into permissions.allow/ask/deny for the chosen scope — same file the Permissions page edits. Precedence is still deny > ask > allow.",
    howNotToUse: [
      "This toggles the WHOLE tool. Setting Bash to Allow allows all Bash — for Bash(git *) or mcp__server use the Permissions page.",
      "It edits the same keys as Permissions; toggling here can override a crafted pattern there (and vice-versa).",
      "'Default' is not 'Deny' — it removes the rule entirely. Don't confuse them.",
    ],
  },
  "/files": {
    title: "Files",
    tagline: "A read-only browser of the project tree.",
    what: "Inspect the project's files (and its .claude/ config) with a click-to-read pane. Directories lazy-load on expand.",
    why: "Look at files without leaving the dashboard.",
    howToUse: [
      "Expand folders, click a file to view it with line numbers.",
      "Binary files and files over 2 MB aren't previewed.",
    ],
    impact: "None — read-only. It does not edit or delete.",
    howNotToUse: [
      "It's a viewer, not an editor — for config edits use the dedicated pages.",
    ],
  },
  "/git": {
    title: "Git Status",
    tagline: "A read-only view of the working tree and diffs.",
    what: "Staged vs unstaged/untracked files against the current branch, with per-file diffs and +/− line counts.",
    why: "See what changed and read diffs before committing, without a terminal.",
    howToUse: [
      "Click a file to load its diff (untracked files show their full body).",
      "Refresh re-reads status. Binary/oversized diffs are hidden.",
    ],
    impact: "None — it only reads git state. It does not stage, commit, push, or discard.",
    howNotToUse: [
      "There are no commit/stage/discard buttons by design — use your terminal or Claude for those.",
    ],
  },
};

export function getGuide(pathname: string): Guide | undefined {
  return GUIDES[pathname];
}
