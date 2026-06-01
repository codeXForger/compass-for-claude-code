import { Hono } from "hono";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { ServerContext } from "../index.js";
import { resolveWithin } from "../lib/fs-safe.js";
import { resolvePaths } from "../lib/paths.js";

type Scope = "project" | "user";

function agentsDir(ctx: ServerContext, scope: Scope): string {
  const p = resolvePaths(ctx.cwd);
  return scope === "project"
    ? join(p.projectClaudeDir, "agents")
    : join(p.userClaudeDir, "agents");
}

function listScope(ctx: ServerContext, scope: Scope) {
  const dir = agentsDir(ctx, scope);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith(".md"))
    .map((name) => ({
      name: name.replace(/\.md$/, ""),
      scope,
      path: join(dir, name),
    }));
}

export function agentsRoute(ctx: ServerContext) {
  const app = new Hono();

  app.get("/", (c) =>
    c.json({
      project: listScope(ctx, "project"),
      user: listScope(ctx, "user"),
    }),
  );

  app.get("/:scope/:name", (c) => {
    const scope = c.req.param("scope") as Scope;
    const file = resolveWithin(agentsDir(ctx, scope), `${c.req.param("name")}.md`);
    if (!file) return c.json({ error: "refused: path traversal" }, 400);
    if (!existsSync(file)) return c.json({ error: "not found" }, 404);
    return c.json({ path: file, content: readFileSync(file, "utf8") });
  });

  app.put("/:scope/:name", async (c) => {
    const scope = c.req.param("scope") as Scope;
    const dir = agentsDir(ctx, scope);
    const file = resolveWithin(dir, `${c.req.param("name")}.md`);
    if (!file) return c.json({ error: "refused: path traversal" }, 400);
    const { content } = await c.req.json<{ content: string }>();
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, content, "utf8");
    return c.json({ ok: true, path: file });
  });

  app.delete("/:scope/:name", (c) => {
    const scope = c.req.param("scope") as Scope;
    const file = resolveWithin(agentsDir(ctx, scope), `${c.req.param("name")}.md`);
    if (!file) return c.json({ error: "refused: path traversal" }, 400);
    if (!existsSync(file)) return c.json({ error: "not found" }, 404);
    unlinkSync(file);
    return c.json({ ok: true });
  });

  return app;
}
