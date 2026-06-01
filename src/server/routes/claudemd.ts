import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { ServerContext } from "../index.js";
import { ensureGitignored, readTextSafe, writeWithBackup } from "../lib/fs-safe.js";
import { resolvePaths } from "../lib/paths.js";

const exec = promisify(execFile);

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

  // CLAUDE.local.md — personal, project-scoped instructions (gitignored).
  app.get("/local", (c) => {
    const content = readTextSafe(paths.projectClaudemdLocal);
    return c.json({
      path: paths.projectClaudemdLocal,
      exists: existsSync(paths.projectClaudemdLocal),
      content,
    });
  });

  app.put("/local", async (c) => {
    const { content } = await c.req.json<{ content: string }>();
    const { backedUpTo } = writeWithBackup(
      paths.projectClaudemdLocal,
      content,
      paths.projectBackupsDir,
    );
    ensureGitignored(ctx.cwd, "CLAUDE.local.md");
    return c.json({ ok: true, path: paths.projectClaudemdLocal, backedUpTo });
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

  // Rephrase + reformat the editor's current text into clean Markdown. Unlike
  // /api/rephrase (which targets a short field and strips fences), this is
  // document-oriented: its job is to PRODUCE well-structured Markdown. One-shot
  // (the diff view needs the whole result); mirrors the rephrase.ts exec shape.
  app.post("/format", async (c) => {
    const { content } = await c.req.json<{ content: string }>();

    if (!content || !content.trim()) {
      return c.json({ error: "Nothing to format." }, 400);
    }

    const prompt =
      `You are reformatting a Claude Code instructions file (CLAUDE.md). Rewrite the ` +
      `document below as clean, well-structured GitHub-flavored Markdown: normalize ` +
      `heading levels, lists, fenced code blocks, tables, and blank-line spacing, and ` +
      `lightly improve wording for clarity. Preserve all meaning, intent, file paths, ` +
      `commands, and code exactly. Return ONLY the Markdown document — no preamble, no ` +
      `explanation, and do NOT wrap the whole thing in an outer code fence.\n\nDocument:\n${content}`;

    try {
      const { stdout } = await exec(
        "claude",
        ["--print", prompt, "--output-format", "text"],
        { cwd: ctx.cwd, timeout: 60000, maxBuffer: 10 * 1024 * 1024 },
      );
      return c.json({ text: stdout.trim() });
    } catch (err) {
      const e = err as { stderr?: string; message?: string };
      return c.json({ error: e.stderr || e.message || "format failed" }, 500);
    }
  });

  return app;
}
