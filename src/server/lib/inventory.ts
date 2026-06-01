import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { readJsonSafe } from "./fs-safe.js";
import { resolvePaths } from "./paths.js";

export interface SessionInfo {
  id: string;
  file: string;
  mtimeMs: number;
  firstUserPrompt: string | null;
  eventCount: number;
}

export function countSkillsByScope(cwd: string): { project: number; user: number } {
  const p = resolvePaths(cwd);
  return {
    project: countSubdirs(join(p.projectClaudeDir, "skills")),
    user: countSubdirs(join(p.userClaudeDir, "skills")),
  };
}

export function countCommandsByScope(cwd: string): { project: number; user: number } {
  const p = resolvePaths(cwd);
  return {
    project: countMdFiles(join(p.projectClaudeDir, "commands")),
    user: countMdFiles(join(p.userClaudeDir, "commands")),
  };
}

export function countAgentsByScope(cwd: string): { project: number; user: number } {
  const p = resolvePaths(cwd);
  return {
    project: countMdFiles(join(p.projectClaudeDir, "agents")),
    user: countMdFiles(join(p.userClaudeDir, "agents")),
  };
}

export function countMcpServers(cwd: string): { project: number; user: number } {
  const p = resolvePaths(cwd);
  let project = 0;
  let user = 0;
  const projectMcp = readJsonSafe<{ mcpServers?: Record<string, unknown> }>(
    p.projectMcp,
  );
  if (projectMcp?.mcpServers) project = Object.keys(projectMcp.mcpServers).length;
  const userJson = readJsonSafe<{ mcpServers?: Record<string, unknown> }>(
    p.userClaudeJson,
  );
  if (userJson?.mcpServers) user = Object.keys(userJson.mcpServers).length;
  return { project, user };
}

export function countPermissions(cwd: string): {
  projectAllow: number;
  projectDeny: number;
  userAllow: number;
  userDeny: number;
} {
  const p = resolvePaths(cwd);
  const proj =
    readJsonSafe<{ permissions?: { allow?: unknown[]; deny?: unknown[] } }>(
      p.projectSettings,
    )?.permissions ?? {};
  const usr =
    readJsonSafe<{ permissions?: { allow?: unknown[]; deny?: unknown[] } }>(
      p.userSettings,
    )?.permissions ?? {};
  return {
    projectAllow: Array.isArray(proj.allow) ? proj.allow.length : 0,
    projectDeny: Array.isArray(proj.deny) ? proj.deny.length : 0,
    userAllow: Array.isArray(usr.allow) ? usr.allow.length : 0,
    userDeny: Array.isArray(usr.deny) ? usr.deny.length : 0,
  };
}

/**
 * Count session files without reading their contents — used where only the
 * total matters (e.g. the dashboard summary), avoiding the cost of parsing
 * every transcript.
 */
export function countSessions(cwd: string): number {
  const dir = resolvePaths(cwd).projectHistoryDir;
  if (!existsSync(dir)) return 0;
  try {
    return readdirSync(dir).filter((n) => n.endsWith(".jsonl")).length;
  } catch {
    return 0;
  }
}

/**
 * Derive the first user prompt and the event count from raw `.jsonl` session
 * content. Shared by the dashboard inventory and the history route so both
 * stay in sync. Reads each line as a self-contained JSON event.
 */
export function parseSessionSummary(content: string): {
  firstUserPrompt: string | null;
  eventCount: number;
} {
  const lines = content.split(/\r?\n/).filter(Boolean);
  let firstUserPrompt: string | null = null;
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj?.type === "user" && typeof obj?.message?.content === "string") {
        firstUserPrompt = obj.message.content.slice(0, 240);
        break;
      }
      if (obj?.role === "user" && typeof obj?.content === "string") {
        firstUserPrompt = obj.content.slice(0, 240);
        break;
      }
    } catch {
      /* skip non-JSON lines */
    }
  }
  return { firstUserPrompt, eventCount: lines.length };
}

export function listSessions(cwd: string, limit?: number): SessionInfo[] {
  const p = resolvePaths(cwd);
  if (!existsSync(p.projectHistoryDir)) return [];
  const entries = readdirSync(p.projectHistoryDir)
    .filter((n) => n.endsWith(".jsonl"))
    .map((name) => {
      const file = join(p.projectHistoryDir, name);
      return {
        id: name.replace(/\.jsonl$/, ""),
        file,
        mtimeMs: statSync(file).mtimeMs,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  const picked = typeof limit === "number" ? entries.slice(0, limit) : entries;

  return picked.map((e) => {
    let content = "";
    try {
      content = readFileSync(e.file, "utf8");
    } catch {
      /* unreadable — treat as empty */
    }
    const { firstUserPrompt, eventCount } = parseSessionSummary(content);
    return {
      id: e.id,
      file: e.file,
      mtimeMs: e.mtimeMs,
      firstUserPrompt,
      eventCount,
    };
  });
}

function countSubdirs(dir: string): number {
  if (!existsSync(dir)) return 0;
  try {
    return readdirSync(dir).filter((n) => {
      try {
        return statSync(join(dir, n)).isDirectory();
      } catch {
        return false;
      }
    }).length;
  } catch {
    return 0;
  }
}

function countMdFiles(dir: string): number {
  if (!existsSync(dir)) return 0;
  try {
    return readdirSync(dir).filter((n) => n.endsWith(".md")).length;
  } catch {
    return 0;
  }
}
