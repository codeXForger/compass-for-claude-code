import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { statusRoute } from "./routes/status.js";
import { settingsRoute } from "./routes/settings.js";
import { skillsRoute } from "./routes/skills.js";
import { hooksRoute } from "./routes/hooks.js";
import { commandsRoute } from "./routes/commands.js";
import { agentsRoute } from "./routes/agents.js";
import { mcpRoute } from "./routes/mcp.js";
import { pluginsRoute } from "./routes/plugins.js";
import { permissionsRoute } from "./routes/permissions.js";
import { toolsRoute } from "./routes/tools.js";
import { claudemdRoute } from "./routes/claudemd.js";
import { rephraseRoute } from "./routes/rephrase.js";
import { historyRoute } from "./routes/history.js";
import { dashboardRoute } from "./routes/dashboard.js";
import { filesRoute } from "./routes/files.js";
import { gitRoute } from "./routes/git.js";
import { attachPtyServer } from "./routes/pty.js";
import { prewarmAuth } from "./lib/claude-bin.js";

export interface ServerContext {
  cwd: string;
  webDir: string;
}

export interface StartOptions extends ServerContext {
  port: number;
}

export async function startServer(opts: StartOptions): Promise<void> {
  const { port, cwd, webDir } = opts;
  const ctx: ServerContext = { cwd, webDir };

  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) return origin;
        if (
          origin.startsWith("http://localhost") ||
          origin.startsWith("http://127.0.0.1")
        ) {
          return origin;
        }
        return null;
      },
    }),
  );

  // API routes
  app.route("/api/status", statusRoute(ctx));
  app.route("/api/settings", settingsRoute(ctx));
  app.route("/api/skills", skillsRoute(ctx));
  app.route("/api/hooks", hooksRoute(ctx));
  app.route("/api/commands", commandsRoute(ctx));
  app.route("/api/agents", agentsRoute(ctx));
  app.route("/api/mcp", mcpRoute(ctx));
  app.route("/api/plugins", pluginsRoute(ctx));
  app.route("/api/permissions", permissionsRoute(ctx));
  app.route("/api/tools", toolsRoute(ctx));
  app.route("/api/claudemd", claudemdRoute(ctx));
  app.route("/api/rephrase", rephraseRoute(ctx));
  app.route("/api/history", historyRoute(ctx));
  app.route("/api/dashboard", dashboardRoute(ctx));
  app.route("/api/files", filesRoute(ctx));
  app.route("/api/git", gitRoute(ctx));

  // Static file serving for the built web UI
  const webExists = existsSync(resolve(webDir, "index.html"));
  if (webExists) {
    app.use(
      "/*",
      serveStatic({
        root: webDir,
        rewriteRequestPath: (path) => path,
      }),
    );
    // SPA fallback — any non-API route returns index.html
    app.get("*", (c) => {
      const indexHtml = readFileSync(resolve(webDir, "index.html"), "utf8");
      return c.html(indexHtml);
    });
  } else {
    app.get("/", (c) =>
      c.text(
        "compass-for-claude-code: web UI not built. Run `npm run build:web`.",
      ),
    );
  }

  const server = serve(
    {
      fetch: app.fetch,
      port,
      hostname: "127.0.0.1",
    },
    (info) => {
      console.log(`  ✓ server ready on ${info.address}:${info.port}\n`);
    },
  );

  attachPtyServer(server, ctx);
  registerShutdown(server);

  // Kick off the auth check immediately so it overlaps with browser load.
  // The first /api/status/auth request will reuse the in-flight result.
  prewarmAuth();
}

function registerShutdown(server: ReturnType<typeof serve>): void {
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) {
      // Second signal — exit immediately.
      process.exit(0);
    }
    shuttingDown = true;
    console.log(`\n  ${signal} received — closing server…`);
    const forceTimer = setTimeout(() => {
      console.log("  shutdown timeout — forcing exit");
      process.exit(0);
    }, 1500);
    forceTimer.unref();

    // Drop any keep-alive connections so the listening socket can free.
    const s = server as unknown as {
      closeAllConnections?: () => void;
      closeIdleConnections?: () => void;
      close: (cb?: (err?: Error) => void) => void;
    };
    s.closeIdleConnections?.();
    s.closeAllConnections?.();
    s.close(() => {
      clearTimeout(forceTimer);
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGHUP", () => shutdown("SIGHUP"));
}
