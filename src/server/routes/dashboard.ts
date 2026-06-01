import { existsSync } from "node:fs";
import { basename } from "node:path";
import { Hono } from "hono";
import type { ServerContext } from "../index.js";
import {
  countAgentsByScope,
  countCommandsByScope,
  countMcpServers,
  countPermissions,
  countSessions,
  countSkillsByScope,
  listSessions,
} from "../lib/inventory.js";
import { readTextSafe } from "../lib/fs-safe.js";
import { resolvePaths } from "../lib/paths.js";

const PREVIEW_CHARS = 400;

export function dashboardRoute(ctx: ServerContext) {
  const app = new Hono();

  app.get("/summary", (c) => {
    const paths = resolvePaths(ctx.cwd);
    const skills = countSkillsByScope(ctx.cwd);
    const commands = countCommandsByScope(ctx.cwd);
    const agents = countAgentsByScope(ctx.cwd);
    const mcp = countMcpServers(ctx.cwd);
    const permissions = countPermissions(ctx.cwd);

    const recentSessions = listSessions(ctx.cwd, 5);
    const allSessionsCount = countSessions(ctx.cwd);
    const latestSession = recentSessions[0] ?? null;

    const claudemdRaw = readTextSafe(paths.projectClaudemd);
    const claudemdPreview =
      claudemdRaw === null
        ? null
        : claudemdRaw.length > PREVIEW_CHARS
          ? claudemdRaw.slice(0, PREVIEW_CHARS).trimEnd() + "…"
          : claudemdRaw;

    return c.json({
      project: {
        name: basename(ctx.cwd),
        cwd: ctx.cwd,
      },
      counts: {
        skills,
        commands,
        agents,
        mcpServers: mcp,
        sessions: allSessionsCount,
        permissions,
      },
      recentSessions,
      latestSession,
      claudemd: {
        exists: claudemdRaw !== null,
        preview: claudemdPreview,
        path: paths.projectClaudemd,
      },
      flags: {
        hasClaudeDir: existsSync(paths.projectClaudeDir),
        hasClaudemd: claudemdRaw !== null,
        hasMcpJson: existsSync(paths.projectMcp),
        hasHistory: existsSync(paths.projectHistoryDir),
        hasProjectSettings: existsSync(paths.projectSettings),
      },
    });
  });

  return app;
}
