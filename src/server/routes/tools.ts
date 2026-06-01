import { Hono } from "hono";
import type { ServerContext } from "../index.js";
import { ensureGitignored, readJsonSafe, writeWithBackup } from "../lib/fs-safe.js";
import { resolvePaths } from "../lib/paths.js";

type Scope = "project" | "user" | "local";
type Verdict = "allow" | "ask" | "deny" | "none";

interface Permissions {
  allow?: string[];
  ask?: string[];
  deny?: string[];
}

interface ToolEntry {
  name: string;
  description: string;
  pattern: string;
}

const BUILT_IN_TOOLS: { name: string; description: string }[] = [
  { name: "Bash", description: "Shell command execution" },
  { name: "Read", description: "Read files" },
  { name: "Write", description: "Write files" },
  { name: "Edit", description: "Edit files" },
  { name: "Glob", description: "Glob file patterns" },
  { name: "Grep", description: "Search file contents" },
  { name: "WebFetch", description: "Fetch a URL" },
  { name: "WebSearch", description: "Search the web" },
  { name: "Task", description: "Launch subagents" },
  { name: "TodoWrite", description: "Manage todo list" },
  { name: "NotebookEdit", description: "Edit Jupyter notebooks" },
];

function patternMatchesTool(pattern: string, tool: ToolEntry): boolean {
  // Exact match
  if (pattern === tool.name || pattern === tool.pattern) return true;
  // Pattern with parens — e.g. Bash(git *) still counts as covering Bash
  const head = pattern.split("(")[0].trim();
  if (head === tool.name || head === tool.pattern) return true;
  // MCP wildcard — mcp__vercel__* covers mcp__vercel
  if (pattern.endsWith("*") && tool.pattern.startsWith(pattern.slice(0, -1))) {
    return true;
  }
  return false;
}

function verdictFor(perms: Permissions, tool: ToolEntry): Verdict {
  // Precedence: deny > ask > allow > none
  if ((perms.deny ?? []).some((p) => patternMatchesTool(p, tool))) return "deny";
  if ((perms.ask ?? []).some((p) => patternMatchesTool(p, tool))) return "ask";
  if ((perms.allow ?? []).some((p) => patternMatchesTool(p, tool))) return "allow";
  return "none";
}

function settingsPathFor(ctx: ServerContext, scope: Scope): string {
  const p = resolvePaths(ctx.cwd);
  if (scope === "local") return p.projectSettingsLocal;
  return scope === "project" ? p.projectSettings : p.userSettings;
}

function loadPermissions(ctx: ServerContext, scope: Scope): Permissions {
  return (
    readJsonSafe<{ permissions?: Permissions }>(settingsPathFor(ctx, scope))
      ?.permissions ?? {}
  );
}

export function toolsRoute(ctx: ServerContext) {
  const app = new Hono();

  app.get("/", (c) => {
    const builtIn: ToolEntry[] = BUILT_IN_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      pattern: t.name,
    }));

    const projectPerms = loadPermissions(ctx, "project");
    const userPerms = loadPermissions(ctx, "user");
    const localPerms = loadPermissions(ctx, "local");

    const tools = builtIn.map((t) => ({
      ...t,
      verdicts: {
        project: verdictFor(projectPerms, t),
        user: verdictFor(userPerms, t),
        local: verdictFor(localPerms, t),
      },
    }));

    return c.json({
      tools,
      permissions: { project: projectPerms, user: userPerms, local: localPerms },
    });
  });

  // POST /set — quick toggle: add/remove a pattern from allow|ask|deny in a scope.
  // body: { scope, pattern, verdict }  verdict = "allow" | "ask" | "deny" | "none"
  app.post("/set", async (c) => {
    const body = await c.req.json<{
      scope: Scope;
      pattern: string;
      verdict: Verdict;
    }>();
    if (!["project", "user", "local"].includes(body.scope))
      return c.json({ error: "invalid scope" }, 400);
    if (!body.pattern) return c.json({ error: "pattern required" }, 400);
    if (!["allow", "ask", "deny", "none"].includes(body.verdict))
      return c.json({ error: "invalid verdict" }, 400);

    const paths = resolvePaths(ctx.cwd);
    const path = settingsPathFor(ctx, body.scope);
    const current =
      readJsonSafe<Record<string, unknown>>(path) ??
      ({} as Record<string, unknown>);
    const perms = (current.permissions as Permissions | undefined) ?? {};
    const allow = new Set(perms.allow ?? []);
    const ask = new Set(perms.ask ?? []);
    const deny = new Set(perms.deny ?? []);

    // Remove the exact pattern from all buckets first.
    allow.delete(body.pattern);
    ask.delete(body.pattern);
    deny.delete(body.pattern);

    if (body.verdict === "allow") allow.add(body.pattern);
    else if (body.verdict === "ask") ask.add(body.pattern);
    else if (body.verdict === "deny") deny.add(body.pattern);
    // "none" → leave removed

    current.permissions = {
      ...perms,
      allow: [...allow],
      ask: [...ask],
      deny: [...deny],
    };
    const { backedUpTo } = writeWithBackup(
      path,
      JSON.stringify(current, null, 2) + "\n",
      paths.projectBackupsDir,
    );
    if (body.scope === "local")
      ensureGitignored(ctx.cwd, ".claude/settings.local.json");
    return c.json({ ok: true, path, backedUpTo });
  });

  return app;
}
