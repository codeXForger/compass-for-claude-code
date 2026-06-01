import { Hono } from "hono";
import type { ServerContext } from "../index.js";
import { readJsonSafe, writeWithBackup } from "../lib/fs-safe.js";
import { resolvePaths } from "../lib/paths.js";

type Scope = "project" | "user";

interface Permissions {
  allow?: string[];
  deny?: string[];
  ask?: string[];
}

function settingsPathFor(ctx: ServerContext, scope: Scope): string {
  const p = resolvePaths(ctx.cwd);
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
    return c.json({ project, user });
  });

  app.put("/:scope", async (c) => {
    const scope = c.req.param("scope") as Scope;
    if (!["project", "user"].includes(scope))
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
    return c.json({ ok: true, path, backedUpTo });
  });

  return app;
}
