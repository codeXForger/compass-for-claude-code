import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import type { ServerContext } from "../index.js";
import { resolveWithin } from "../lib/fs-safe.js";
import { parseSessionSummary } from "../lib/inventory.js";
import { resolvePaths } from "../lib/paths.js";

interface SessionSummary {
  id: string;
  file: string;
  size: number;
  mtimeMs: number;
  firstUserPrompt: string | null;
  eventCount: number;
}

export function historyRoute(ctx: ServerContext) {
  const app = new Hono();
  const paths = resolvePaths(ctx.cwd);

  app.get("/", (c) => {
    if (!existsSync(paths.projectHistoryDir)) {
      return c.json({ dir: paths.projectHistoryDir, sessions: [] });
    }
    const sessions: SessionSummary[] = readdirSync(paths.projectHistoryDir)
      .filter((n) => n.endsWith(".jsonl"))
      .map((name) => {
        const file = join(paths.projectHistoryDir, name);
        const st = statSync(file);
        let content = "";
        try {
          content = readFileSync(file, "utf8");
        } catch {
          /* unreadable — treat as empty */
        }
        const { firstUserPrompt, eventCount } = parseSessionSummary(content);
        return {
          id: name.replace(/\.jsonl$/, ""),
          file,
          size: st.size,
          mtimeMs: st.mtimeMs,
          firstUserPrompt,
          eventCount,
        };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    return c.json({ dir: paths.projectHistoryDir, sessions });
  });

  app.get("/:id", (c) => {
    const id = c.req.param("id");
    const file = resolveWithin(paths.projectHistoryDir, `${id}.jsonl`);
    if (!file) return c.json({ error: "refused: path traversal" }, 400);
    if (!existsSync(file)) return c.json({ error: "not found" }, 404);
    const events = readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { type: "unparsed", raw: line };
        }
      });
    return c.json({ id, file, events });
  });

  return app;
}
