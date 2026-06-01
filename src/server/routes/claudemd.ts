import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { ServerContext } from "../index.js";
import { readTextSafe, writeWithBackup } from "../lib/fs-safe.js";
import { resolvePaths } from "../lib/paths.js";

export function claudemdRoute(ctx: ServerContext) {
  const app = new Hono();
  const paths = resolvePaths(ctx.cwd);

  app.get("/", (c) => {
    const content = readTextSafe(paths.projectClaudemd);
    return c.json({
      path: paths.projectClaudemd,
      exists: existsSync(paths.projectClaudemd),
      content,
    });
  });

  app.put("/", async (c) => {
    const { content } = await c.req.json<{ content: string }>();
    const { backedUpTo } = writeWithBackup(
      paths.projectClaudemd,
      content,
      paths.projectBackupsDir,
    );
    return c.json({ ok: true, path: paths.projectClaudemd, backedUpTo });
  });

  app.post("/generate", async (c) => {
    return streamSSE(c, async (stream) => {
      const child = spawn(
        "claude",
        [
          "--print",
          "/init",
          "--allowedTools",
          "Read,Glob,Grep,Write,Edit",
          "--permission-mode",
          "acceptEdits",
          "--output-format",
          "text",
        ],
        { cwd: ctx.cwd },
      );

      child.stdout.on("data", async (chunk: Buffer) => {
        await stream.writeSSE({
          event: "chunk",
          data: chunk.toString("utf8"),
        });
      });
      child.stderr.on("data", async (chunk: Buffer) => {
        await stream.writeSSE({
          event: "stderr",
          data: chunk.toString("utf8"),
        });
      });
      await new Promise<void>((resolve) => {
        child.on("close", async (code) => {
          if (code === 0 && existsSync(paths.projectClaudemd)) {
            await stream.writeSSE({
              event: "done",
              data: JSON.stringify({ path: paths.projectClaudemd }),
            });
          } else {
            await stream.writeSSE({
              event: "error",
              data: `claude /init exited with code ${code}`,
            });
          }
          resolve();
        });
      });
    });
  });

  return app;
}
