import type { Http2SecureServer, Http2Server } from "node:http2";
import type { Server } from "node:http";
import { WebSocketServer } from "ws";
import type { ServerContext } from "../index.js";

type AnyHttpServer = Server | Http2Server | Http2SecureServer;

/**
 * Attaches a WebSocket server at /api/pty for xterm.js terminal sessions.
 * The client sends an initial JSON message:
 *   { type: "start", command?: "claude setup-token" | "shell", cols?, rows? }
 * Then binary/text frames carry stdin keystrokes; the server streams stdout/stderr back.
 *
 * node-pty is a peer dep — if it fails to load (no prebuilt for this platform),
 * we send an error frame and close.
 */
export function attachPtyServer(server: AnyHttpServer, ctx: ServerContext): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    if (!req.url) return;
    if (!req.url.startsWith("/api/pty")) return;
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", async (ws) => {
    let pty: import("node-pty").IPty | null = null;
    let ptyModule: typeof import("node-pty") | null = null;
    try {
      ptyModule = await import("node-pty");
    } catch (err) {
      ws.send(
        JSON.stringify({
          type: "error",
          message:
            "node-pty failed to load. The embedded terminal is unavailable on this platform. Open a real terminal and run `claude setup-token` instead. " +
            String(err),
        }),
      );
      ws.close();
      return;
    }

    ws.on("message", (raw) => {
      const text = raw.toString();
      // First message starts the pty; subsequent messages are stdin.
      if (!pty) {
        let opts: { command?: string; cols?: number; rows?: number } = {};
        try {
          opts = JSON.parse(text);
        } catch {
          // treat as shell start
        }
        const shell =
          opts.command === "claude-setup"
            ? "claude"
            : process.platform === "win32"
              ? "powershell.exe"
              : process.env.SHELL || "bash";
        const args =
          opts.command === "claude-setup" ? ["setup-token"] : [];
        pty = ptyModule!.spawn(shell, args, {
          name: "xterm-color",
          cols: opts.cols ?? 80,
          rows: opts.rows ?? 24,
          cwd: ctx.cwd,
          env: process.env as Record<string, string>,
        });
        pty.onData((data) => {
          if (ws.readyState === ws.OPEN) ws.send(data);
        });
        pty.onExit(({ exitCode }) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(
              JSON.stringify({ type: "exit", code: exitCode }),
            );
            ws.close();
          }
        });
        return;
      }
      // Resize frames look like {type:"resize", cols, rows}
      if (text.startsWith("{")) {
        try {
          const obj = JSON.parse(text);
          if (obj.type === "resize" && obj.cols && obj.rows) {
            pty.resize(obj.cols, obj.rows);
            return;
          }
        } catch {
          // fall through and treat as input
        }
      }
      pty.write(text);
    });

    ws.on("close", () => {
      try {
        pty?.kill();
      } catch {
        /* ignore */
      }
    });
  });
}
