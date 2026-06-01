import { Hono } from "hono";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { ServerContext } from "../index.js";
import { resolveWithin } from "../lib/fs-safe.js";

/** Directories never worth showing in the project tree. */
const IGNORED = new Set([".git", "node_modules", ".DS_Store"]);
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB — refuse to stream anything larger

type EntryType = "dir" | "file";

interface DirEntry {
  name: string;
  /** Path relative to the project cwd (posix-style separators kept as-is). */
  path: string;
  type: EntryType;
}

/**
 * Read-only project file browser. Lists a directory's immediate children
 * (lazy — the UI expands one level at a time) and streams a single file's
 * contents. Every path is validated with `resolveWithin(cwd, …)` so requests
 * can never escape the target project.
 */
export function filesRoute(ctx: ServerContext) {
  const app = new Hono();

  // List the immediate children of a directory. `path` is relative to cwd and
  // defaults to the project root.
  app.get("/", (c) => {
    const rel = c.req.query("path") ?? "";
    const dir = resolveWithin(ctx.cwd, rel);
    if (!dir) return c.json({ error: "refused: path traversal" }, 400);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      return c.json({ error: "not a directory" }, 404);
    }

    const entries: DirEntry[] = readdirSync(dir, { withFileTypes: true })
      .filter((d) => !IGNORED.has(d.name))
      .map((d) => {
        const full = join(dir, d.name);
        let isDir = d.isDirectory();
        if (d.isSymbolicLink()) {
          // Resolve the link target to classify it; broken links read as files.
          try {
            isDir = statSync(full).isDirectory();
          } catch {
            isDir = false;
          }
        }
        return {
          name: d.name,
          path: relative(ctx.cwd, full),
          type: isDir ? "dir" : "file",
        } satisfies DirEntry;
      })
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    return c.json({ cwd: ctx.cwd, path: rel, entries });
  });

  // Stream a single file's contents. Refuses directories, oversized files, and
  // binaries (reported via flags so the UI can explain why there is no text).
  app.get("/content", (c) => {
    const rel = c.req.query("path");
    if (!rel) return c.json({ error: "missing path" }, 400);
    const file = resolveWithin(ctx.cwd, rel);
    if (!file) return c.json({ error: "refused: path traversal" }, 400);
    if (!existsSync(file)) return c.json({ error: "not found" }, 404);

    const st = statSync(file);
    if (st.isDirectory()) return c.json({ error: "is a directory" }, 400);
    if (st.size > MAX_FILE_BYTES) {
      return c.json({ path: rel, size: st.size, tooLarge: true, content: null });
    }

    const buf = readFileSync(file);
    if (isBinary(buf)) {
      return c.json({ path: rel, size: st.size, binary: true, content: null });
    }
    return c.json({ path: rel, size: st.size, content: buf.toString("utf8") });
  });

  return app;
}

/** Heuristic: a NUL byte in the first 8 KB means "treat as binary". */
function isBinary(buf: Buffer): boolean {
  const len = Math.min(buf.length, 8000);
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}
