import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Hono } from "hono";
import type { ServerContext } from "../index.js";

const exec = promisify(execFile);

/**
 * One-shot text rephrasing. Shells out to the user's installed `claude` CLI
 * (the same backend dependency used by mcp/claudemd routes) to rewrite a
 * free-text config field into clean, well-formed content.
 */
export function rephraseRoute(ctx: ServerContext) {
  const app = new Hono();

  app.post("/", async (c) => {
    // `module` shadows a Node global — destructure it under a safe name.
    const { module: moduleName, field, content } = await c.req.json<{
      module: string;
      field: string;
      content: string;
    }>();

    if (!content || !content.trim()) {
      return c.json({ error: "Nothing to rephrase." }, 400);
    }

    const prompt =
      `You are improving a Claude Code configuration file. The user is editing the ` +
      `"${field}" field of the ${moduleName} module. Rewrite the content below in clear, ` +
      `well-formed English suitable for that field, preserving its meaning and any ` +
      `technical terms, file paths, or code. Return ONLY the rewritten text — no preamble, ` +
      `no explanation, no surrounding quotes or markdown fences.\n\nContent:\n${content}`;

    try {
      const { stdout } = await exec(
        "claude",
        ["--print", prompt, "--output-format", "text"],
        { cwd: ctx.cwd, timeout: 60000, maxBuffer: 10 * 1024 * 1024 },
      );
      return c.json({ text: stdout.trim() });
    } catch (err) {
      const e = err as { stderr?: string; message?: string };
      return c.json({ error: e.stderr || e.message || "rephrase failed" }, 500);
    }
  });

  return app;
}
