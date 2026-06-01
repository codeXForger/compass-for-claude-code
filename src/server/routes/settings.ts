import { Hono } from "hono";
import type { ServerContext } from "../index.js";
import { readTextSafe, writeWithBackup } from "../lib/fs-safe.js";
import { resolvePaths } from "../lib/paths.js";

type Scope = "project" | "user";
type Variant = "settings" | "settingsLocal";

function fileFor(ctx: ServerContext, scope: Scope, variant: Variant): string {
  const p = resolvePaths(ctx.cwd);
  if (scope === "project") {
    return variant === "settings" ? p.projectSettings : p.projectSettingsLocal;
  }
  return variant === "settings" ? p.userSettings : p.userSettingsLocal;
}

export function settingsRoute(ctx: ServerContext) {
  const app = new Hono();

  app.get("/", (c) => {
    const variants: Variant[] = ["settings", "settingsLocal"];
    const scopes: Scope[] = ["project", "user"];
    const result: Record<string, { path: string; content: string | null }> = {};
    for (const scope of scopes) {
      for (const variant of variants) {
        const path = fileFor(ctx, scope, variant);
        result[`${scope}.${variant}`] = {
          path,
          content: readTextSafe(path),
        };
      }
    }
    return c.json(result);
  });

  app.put("/:scope/:variant", async (c) => {
    const scope = c.req.param("scope") as Scope;
    const variant = c.req.param("variant") as Variant;
    if (!["project", "user"].includes(scope))
      return c.json({ error: "invalid scope" }, 400);
    if (!["settings", "settingsLocal"].includes(variant))
      return c.json({ error: "invalid variant" }, 400);

    const { content } = await c.req.json<{ content: string }>();
    try {
      JSON.parse(content);
    } catch (err) {
      return c.json({ error: `invalid JSON: ${(err as Error).message}` }, 400);
    }
    const path = fileFor(ctx, scope, variant);
    const { projectBackupsDir } = resolvePaths(ctx.cwd);
    const { backedUpTo } = writeWithBackup(path, content, projectBackupsDir);
    return c.json({ ok: true, path, backedUpTo });
  });

  return app;
}
