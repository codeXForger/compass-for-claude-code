import { Hono } from "hono";
import type { ServerContext } from "../index.js";
import { ensureGitignored, readJsonSafe, writeWithBackup } from "../lib/fs-safe.js";
import { resolvePaths } from "../lib/paths.js";

type Scope = "project" | "user" | "local";

function settingsPathFor(ctx: ServerContext, scope: Scope): string {
  const p = resolvePaths(ctx.cwd);
  if (scope === "local") return p.projectSettingsLocal;
  return scope === "project" ? p.projectSettings : p.userSettings;
}

export function hooksRoute(ctx: ServerContext) {
  const app = new Hono();

  app.get("/", (c) => {
    const projectSettings =
      readJsonSafe<Record<string, unknown>>(settingsPathFor(ctx, "project")) ??
      {};
    const userSettings =
      readJsonSafe<Record<string, unknown>>(settingsPathFor(ctx, "user")) ?? {};
    const localSettings =
      readJsonSafe<Record<string, unknown>>(settingsPathFor(ctx, "local")) ?? {};
    return c.json({
      project: projectSettings.hooks ?? null,
      user: userSettings.hooks ?? null,
      local: localSettings.hooks ?? null,
    });
  });

  app.put("/:scope", async (c) => {
    const scope = c.req.param("scope") as Scope;
    if (!["project", "user", "local"].includes(scope))
      return c.json({ error: "invalid scope" }, 400);
    const { hooks } = await c.req.json<{ hooks: unknown }>();
    const path = settingsPathFor(ctx, scope);
    const current =
      readJsonSafe<Record<string, unknown>>(path) ?? ({} as Record<string, unknown>);
    current.hooks = hooks;
    const { projectBackupsDir } = resolvePaths(ctx.cwd);
    const { backedUpTo } = writeWithBackup(
      path,
      JSON.stringify(current, null, 2) + "\n",
      projectBackupsDir,
    );
    if (scope === "local")
      ensureGitignored(ctx.cwd, ".claude/settings.local.json");
    return c.json({ ok: true, path, backedUpTo });
  });

  return app;
}
