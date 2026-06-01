import { Hono } from "hono";
import { existsSync } from "node:fs";
import type { ServerContext } from "../index.js";
import {
  checkAuth,
  clearAuthCache,
  detectClaudeFast,
} from "../lib/claude-bin.js";
import { resolvePaths } from "../lib/paths.js";

export function statusRoute(ctx: ServerContext) {
  const app = new Hono();

  // Fast: returns immediately. No claude --print subprocess.
  app.get("/", async (c) => {
    const paths = resolvePaths(ctx.cwd);
    const claude = await detectClaudeFast();
    return c.json({
      claude,
      paths,
      flags: {
        hasClaudeDir: existsSync(paths.projectClaudeDir),
        hasClaudemd: existsSync(paths.projectClaudemd),
        hasMcpJson: existsSync(paths.projectMcp),
        hasHistory: existsSync(paths.projectHistoryDir),
      },
    });
  });

  // Slow: runs `claude --print "ok"` once, caches for 5 minutes.
  app.get("/auth", async (c) => {
    const force = c.req.query("force") === "1";
    const auth = await checkAuth(force);
    return c.json(auth);
  });

  app.post("/auth/refresh", (c) => {
    clearAuthCache();
    return c.json({ ok: true });
  });

  return app;
}
