import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Hono } from "hono";
import type { ServerContext } from "../index.js";

const exec = promisify(execFile);

type Scope = "user" | "project" | "local";

interface InstallRequest {
  plugin: string;
  scope?: Scope;
  config?: Record<string, string>;
}

interface ToggleRequest {
  scope?: Scope;
}

interface MarketplaceAddRequest {
  source: string;
  scope?: Scope;
  sparse?: string[];
}

interface PluginEntry {
  id: string;
  version?: string;
  scope: Scope;
  enabled: boolean;
  installPath?: string;
  installedAt?: string;
  lastUpdated?: string;
  projectPath?: string;
  mcpServers?: Record<string, unknown>;
}

interface MarketplaceEntry {
  name: string;
  source?: { source: string; repo?: string; url?: string; path?: string };
  installLocation?: string;
  lastUpdated?: string;
}

function pluginError(err: unknown): string {
  const e = err as { stderr?: string; message?: string };
  return e.stderr?.trim() || e.message || "failed";
}

export function pluginsRoute(ctx: ServerContext) {
  const app = new Hono();

  // GET /              → installed plugins
  // GET /?available=1  → installed + available from marketplaces
  app.get("/", async (c) => {
    const includeAvailable = c.req.query("available") === "1";
    const args = ["plugin", "list", "--json"];
    if (includeAvailable) args.push("--available");
    try {
      const { stdout } = await exec("claude", args, {
        cwd: ctx.cwd,
        timeout: 20000,
      });
      const parsed = JSON.parse(stdout);
      // When --available, claude returns {installed: [...], available: [...]}
      if (includeAvailable && parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return c.json({
          installed: (parsed.installed ?? []) as PluginEntry[],
          available: (parsed.available ?? []) as PluginEntry[],
        });
      }
      return c.json({ installed: parsed as PluginEntry[], available: [] });
    } catch (err) {
      return c.json({ error: pluginError(err) }, 500);
    }
  });

  // GET /:plugin/details → component inventory + token cost
  app.get("/:plugin/details", async (c) => {
    const name = c.req.param("plugin");
    try {
      const { stdout } = await exec("claude", ["plugin", "details", name], {
        cwd: ctx.cwd,
        timeout: 20000,
      });
      return c.json({ plugin: name, raw: stdout });
    } catch (err) {
      return c.json({ error: pluginError(err) }, 500);
    }
  });

  // POST / → install
  app.post("/", async (c) => {
    const body = await c.req.json<InstallRequest>();
    if (!body.plugin) return c.json({ error: "plugin required" }, 400);

    const args: string[] = ["plugin", "install"];
    if (body.scope) args.push("--scope", body.scope);
    for (const [k, v] of Object.entries(body.config ?? {})) {
      args.push("--config", `${k}=${v}`);
    }
    args.push(body.plugin);

    try {
      const { stdout, stderr } = await exec("claude", args, {
        cwd: ctx.cwd,
        timeout: 120000,
      });
      return c.json({ ok: true, stdout, stderr });
    } catch (err) {
      return c.json({ error: pluginError(err) }, 500);
    }
  });

  // DELETE /:plugin → uninstall
  app.delete("/:plugin", async (c) => {
    const name = c.req.param("plugin");
    const scope = c.req.query("scope") as Scope | undefined;
    const args = ["plugin", "uninstall", "-y"];
    if (scope) args.push("--scope", scope);
    args.push(name);
    try {
      const { stdout } = await exec("claude", args, {
        cwd: ctx.cwd,
        timeout: 60000,
      });
      return c.json({ ok: true, stdout });
    } catch (err) {
      return c.json({ error: pluginError(err) }, 500);
    }
  });

  // POST /:plugin/enable
  app.post("/:plugin/enable", async (c) => {
    const name = c.req.param("plugin");
    const body = await c.req.json<ToggleRequest>().catch(() => ({} as ToggleRequest));
    const args = ["plugin", "enable"];
    if (body.scope) args.push("--scope", body.scope);
    args.push(name);
    try {
      const { stdout } = await exec("claude", args, {
        cwd: ctx.cwd,
        timeout: 15000,
      });
      return c.json({ ok: true, stdout });
    } catch (err) {
      return c.json({ error: pluginError(err) }, 500);
    }
  });

  // POST /:plugin/disable
  app.post("/:plugin/disable", async (c) => {
    const name = c.req.param("plugin");
    const body = await c.req.json<ToggleRequest>().catch(() => ({} as ToggleRequest));
    const args = ["plugin", "disable"];
    if (body.scope) args.push("--scope", body.scope);
    args.push(name);
    try {
      const { stdout } = await exec("claude", args, {
        cwd: ctx.cwd,
        timeout: 15000,
      });
      return c.json({ ok: true, stdout });
    } catch (err) {
      return c.json({ error: pluginError(err) }, 500);
    }
  });

  // POST /:plugin/update
  app.post("/:plugin/update", async (c) => {
    const name = c.req.param("plugin");
    try {
      const { stdout } = await exec("claude", ["plugin", "update", name], {
        cwd: ctx.cwd,
        timeout: 120000,
      });
      return c.json({ ok: true, stdout });
    } catch (err) {
      return c.json({ error: pluginError(err) }, 500);
    }
  });

  // ---------- marketplaces ----------

  app.get("/marketplaces/list", async (c) => {
    try {
      const { stdout } = await exec(
        "claude",
        ["plugin", "marketplace", "list", "--json"],
        { cwd: ctx.cwd, timeout: 15000 },
      );
      // Output is an object keyed by marketplace name.
      const parsed = JSON.parse(stdout) as Record<string, Omit<MarketplaceEntry, "name">>;
      const marketplaces: MarketplaceEntry[] = Object.entries(parsed).map(
        ([name, info]) => ({ name, ...info }),
      );
      return c.json({ marketplaces });
    } catch (err) {
      return c.json({ error: pluginError(err) }, 500);
    }
  });

  app.post("/marketplaces", async (c) => {
    const body = await c.req.json<MarketplaceAddRequest>();
    if (!body.source) return c.json({ error: "source required" }, 400);
    const args = ["plugin", "marketplace", "add"];
    if (body.scope) args.push("--scope", body.scope);
    if (body.sparse && body.sparse.length) {
      args.push("--sparse", ...body.sparse);
    }
    args.push(body.source);
    try {
      const { stdout, stderr } = await exec("claude", args, {
        cwd: ctx.cwd,
        timeout: 120000,
      });
      return c.json({ ok: true, stdout, stderr });
    } catch (err) {
      return c.json({ error: pluginError(err) }, 500);
    }
  });

  app.delete("/marketplaces/:name", async (c) => {
    const name = c.req.param("name");
    try {
      const { stdout } = await exec(
        "claude",
        ["plugin", "marketplace", "remove", name],
        { cwd: ctx.cwd, timeout: 15000 },
      );
      return c.json({ ok: true, stdout });
    } catch (err) {
      return c.json({ error: pluginError(err) }, 500);
    }
  });

  app.post("/marketplaces/:name/update", async (c) => {
    const name = c.req.param("name");
    try {
      const { stdout } = await exec(
        "claude",
        ["plugin", "marketplace", "update", name],
        { cwd: ctx.cwd, timeout: 120000 },
      );
      return c.json({ ok: true, stdout });
    } catch (err) {
      return c.json({ error: pluginError(err) }, 500);
    }
  });

  return app;
}
