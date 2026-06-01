import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Hono } from "hono";
import type { ServerContext } from "../index.js";

const exec = promisify(execFile);

interface McpAddRequest {
  name: string;
  transport: "stdio" | "http" | "sse";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
  scope?: "user" | "project" | "local";
}

export function mcpRoute(ctx: ServerContext) {
  const app = new Hono();

  app.get("/", async (c) => {
    try {
      const { stdout } = await exec("claude", ["mcp", "list"], {
        cwd: ctx.cwd,
        timeout: 15000,
      });
      // claude mcp list isn't always JSON — parse line-by-line as a fallback.
      const lines = stdout.split(/\r?\n/).filter(Boolean);
      const servers = lines
        .map((line) => {
          const m = line.match(/^([\w.-]+):\s*(.+)$/);
          if (!m) return null;
          return { name: m[1], summary: m[2] };
        })
        .filter(Boolean);
      return c.json({ raw: stdout, servers });
    } catch (err) {
      const e = err as { stderr?: string; message?: string };
      return c.json({ error: e.stderr || e.message || "failed" }, 500);
    }
  });

  app.get("/:name", async (c) => {
    const name = c.req.param("name");
    try {
      const { stdout } = await exec("claude", ["mcp", "get", name], {
        cwd: ctx.cwd,
        timeout: 15000,
      });
      return c.json({ name, raw: stdout });
    } catch (err) {
      const e = err as { stderr?: string; message?: string };
      return c.json({ error: e.stderr || e.message || "failed" }, 500);
    }
  });

  app.post("/", async (c) => {
    const body = await c.req.json<McpAddRequest>();
    if (!body.name) return c.json({ error: "name required" }, 400);

    const args: string[] = ["mcp", "add"];
    if (body.scope) args.push("--scope", body.scope);
    if (body.transport && body.transport !== "stdio") {
      args.push("--transport", body.transport);
    }
    for (const [k, v] of Object.entries(body.env ?? {})) {
      args.push("-e", `${k}=${v}`);
    }
    for (const [k, v] of Object.entries(body.headers ?? {})) {
      args.push("--header", `${k}: ${v}`);
    }
    args.push(body.name);

    if (body.transport === "stdio" || !body.transport) {
      if (!body.command) return c.json({ error: "command required" }, 400);
      args.push("--", body.command, ...(body.args ?? []));
    } else {
      if (!body.url) return c.json({ error: "url required" }, 400);
      args.push(body.url);
    }

    try {
      const { stdout, stderr } = await exec("claude", args, {
        cwd: ctx.cwd,
        timeout: 30000,
      });
      return c.json({ ok: true, stdout, stderr });
    } catch (err) {
      const e = err as { stderr?: string; message?: string };
      return c.json({ error: e.stderr || e.message || "failed" }, 500);
    }
  });

  app.delete("/:name", async (c) => {
    const name = c.req.param("name");
    try {
      const { stdout } = await exec("claude", ["mcp", "remove", name], {
        cwd: ctx.cwd,
        timeout: 15000,
      });
      return c.json({ ok: true, stdout });
    } catch (err) {
      const e = err as { stderr?: string; message?: string };
      return c.json({ error: e.stderr || e.message || "failed" }, 500);
    }
  });

  return app;
}
