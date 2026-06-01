import { Hono } from "hono";
import type { ServerContext } from "../index.js";
import { ensureGitignored, readJsonSafe, writeWithBackup } from "../lib/fs-safe.js";
import { resolvePaths } from "../lib/paths.js";

type Scope = "project" | "user" | "local";

interface Permissions {
  allow?: string[];
  deny?: string[];
  ask?: string[];
}

function settingsPathFor(ctx: ServerContext, scope: Scope): string {
  const p = resolvePaths(ctx.cwd);
  if (scope === "local") return p.projectSettingsLocal;
  return scope === "project" ? p.projectSettings : p.userSettings;
}

export function permissionsRoute(ctx: ServerContext) {
  const app = new Hono();

  app.get("/", (c) => {
    const project =
      readJsonSafe<{ permissions?: Permissions }>(
        settingsPathFor(ctx, "project"),
      )?.permissions ?? {};
    const user =
      readJsonSafe<{ permissions?: Permissions }>(
        settingsPathFor(ctx, "user"),
      )?.permissions ?? {};
    const local =
      readJsonSafe<{ permissions?: Permissions }>(
        settingsPathFor(ctx, "local"),
      )?.permissions ?? {};
    return c.json({ project, user, local });
  });

  app.put("/:scope", async (c) => {
    const scope = c.req.param("scope") as Scope;
    if (!["project", "user", "local"].includes(scope))
      return c.json({ error: "invalid scope" }, 400);
    const { permissions } = await c.req.json<{ permissions: Permissions }>();
    const path = settingsPathFor(ctx, scope);
    const current =
      readJsonSafe<Record<string, unknown>>(path) ?? ({} as Record<string, unknown>);
    current.permissions = permissions;
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
