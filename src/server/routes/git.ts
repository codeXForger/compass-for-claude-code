import { Hono } from "hono";
import { execFile } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { promisify } from "node:util";
import type { ServerContext } from "../index.js";
import { resolveWithin } from "../lib/fs-safe.js";

const exec = promisify(execFile);

const MAX_DIFF_BYTES = 1 * 1024 * 1024; // 1 MB cap on a single file's diff/body

type ChangeType =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "untracked"
  | "conflicted"
  | "typechange";

interface GitFile {
  path: string;
  /** Original path for renames/copies. */
  orig: string | null;
  /** Staged status char (X), e.g. "M", "A", "R", or " ". */
  index: string;
  /** Unstaged status char (Y). */
  worktree: string;
  staged: boolean;
  unstaged: boolean;
  type: ChangeType;
  /** Lines added; null for binary or uncountable. */
  added: number | null;
  /** Lines removed; null for binary or uncountable. */
  removed: number | null;
}

interface NumStat {
  added: number | null;
  removed: number | null;
}

/**
 * Git status + per-file diff. Shells out to the user's `git` (cwd = project)
 * rather than reimplementing porcelain parsing in JS. Degrades gracefully when
 * the project is not a git repository.
 */
export function gitRoute(ctx: ServerContext) {
  const app = new Hono();

  app.get("/status", async (c) => {
    if (!(await isGitRepo(ctx.cwd))) {
      return c.json({ isRepo: false, branch: null, files: [] });
    }

    const branch = await currentBranch(ctx.cwd);
    const { stdout } = await exec(
      "git",
      ["status", "--porcelain", "-z", "--untracked-files=all"],
      { cwd: ctx.cwd, maxBuffer: 32 * 1024 * 1024 },
    );
    const files = parsePorcelain(stdout);

    // Merge in line counts from staged + unstaged numstat, keyed on the final
    // (new) path so it lines up with the porcelain entries.
    const counts = await collectNumstat(ctx.cwd);
    for (const f of files) {
      if (f.type === "untracked") {
        const n = countUntracked(ctx.cwd, f.path);
        f.added = n.added;
        f.removed = n.removed;
        continue;
      }
      const n = counts.get(f.path);
      if (n) {
        f.added = n.added;
        f.removed = n.removed;
      }
    }

    return c.json({ isRepo: true, branch, files });
  });

  // Unified diff for one file (working tree vs HEAD). Untracked files have no
  // diff, so we return their contents flagged as all-added.
  app.get("/diff", async (c) => {
    const rel = c.req.query("path");
    if (!rel) return c.json({ error: "missing path" }, 400);
    const abs = resolveWithin(ctx.cwd, rel);
    if (!abs) return c.json({ error: "refused: path traversal" }, 400);
    if (!(await isGitRepo(ctx.cwd))) {
      return c.json({ error: "not a git repository" }, 400);
    }

    const untracked = c.req.query("untracked") === "1";
    if (untracked) {
      if (!existsSync(abs)) return c.json({ error: "not found" }, 404);
      const buf = readFileSync(abs);
      if (statSync(abs).size > MAX_DIFF_BYTES || hasNul(buf)) {
        return c.json({ path: rel, untracked: true, diff: null, tooLargeOrBinary: true });
      }
      return c.json({ path: rel, untracked: true, body: buf.toString("utf8") });
    }

    let diff = await runDiff(ctx.cwd, ["diff", "HEAD", "--", rel]);
    if (!diff.trim()) {
      // No HEAD yet (fresh repo) or staged-only edge cases.
      diff = await runDiff(ctx.cwd, ["diff", "--cached", "--", rel]);
    }
    return c.json({ path: rel, diff });
  });

  return app;
}

async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await exec("git", ["rev-parse", "--is-inside-work-tree"], { cwd });
    return true;
  } catch {
    return false;
  }
}

async function currentBranch(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await exec("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd,
    });
    const b = stdout.trim();
    return b === "HEAD" ? "(detached)" : b;
  } catch {
    return null;
  }
}

async function runDiff(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await exec("git", args, {
      cwd,
      maxBuffer: MAX_DIFF_BYTES,
    });
    return stdout;
  } catch (err) {
    // maxBuffer overflow or git error — surface a readable note rather than 500.
    const e = err as { code?: string; message?: string };
    if (e.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
      return "// diff too large to display";
    }
    return "";
  }
}

/**
 * Parse `git status --porcelain -z`. Records are NUL-separated; a rename/copy
 * entry is followed by a second NUL field holding the original path.
 */
function parsePorcelain(out: string): GitFile[] {
  const tokens = out.split("\0");
  const files: GitFile[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const entry = tokens[i];
    if (!entry) continue;
    const index = entry[0];
    const worktree = entry[1];
    const path = entry.slice(3);

    let orig: string | null = null;
    if (index === "R" || index === "C" || worktree === "R" || worktree === "C") {
      orig = tokens[i + 1] ?? null;
      i += 1; // consume the original-path token
    }

    files.push({
      path,
      orig,
      index,
      worktree,
      staged: index !== " " && index !== "?",
      unstaged: worktree !== " " && worktree !== "?",
      type: classify(index, worktree),
      added: null,
      removed: null,
    });
  }
  return files;
}

function classify(index: string, worktree: string): ChangeType {
  if (index === "?" || worktree === "?") return "untracked";
  if (
    index === "U" ||
    worktree === "U" ||
    (index === "A" && worktree === "A") ||
    (index === "D" && worktree === "D")
  ) {
    return "conflicted";
  }
  if (index === "R" || worktree === "R") return "renamed";
  if (index === "C" || worktree === "C") return "copied";
  if (index === "A" || worktree === "A") return "added";
  if (index === "D" || worktree === "D") return "deleted";
  if (index === "T" || worktree === "T") return "typechange";
  return "modified";
}

/**
 * Sum line counts across staged + unstaged changes, keyed on the final path.
 * Uses `--numstat -z`, where a rename is emitted as `add\tdel\t` then two
 * NUL fields: the old path, then the new path.
 */
async function collectNumstat(cwd: string): Promise<Map<string, NumStat>> {
  const map = new Map<string, NumStat>();
  for (const args of [
    ["diff", "--numstat", "-z"],
    ["diff", "--cached", "--numstat", "-z"],
  ]) {
    let stdout = "";
    try {
      ({ stdout } = await exec("git", args, {
        cwd,
        maxBuffer: 32 * 1024 * 1024,
      }));
    } catch {
      continue;
    }
    parseNumstat(stdout, map);
  }
  return map;
}

function parseNumstat(out: string, map: Map<string, NumStat>): void {
  const tokens = out.split("\0");
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;
    const tab1 = token.indexOf("\t");
    const tab2 = token.indexOf("\t", tab1 + 1);
    if (tab1 < 0 || tab2 < 0) continue;
    const addStr = token.slice(0, tab1);
    const delStr = token.slice(tab1 + 1, tab2);
    let path = token.slice(tab2 + 1);

    if (path === "") {
      // Rename: the next two NUL fields are <old>, <new>; key on <new>.
      path = tokens[i + 2] ?? "";
      i += 2;
    }
    if (!path) continue;

    const added = addStr === "-" ? null : Number(addStr);
    const removed = delStr === "-" ? null : Number(delStr);
    const prev = map.get(path);
    map.set(path, {
      added: sumNullable(prev?.added, added),
      removed: sumNullable(prev?.removed, removed),
    });
  }
}

function sumNullable(a: number | null | undefined, b: number | null): number | null {
  if (a == null && b == null) return null;
  return (a ?? 0) + (b ?? 0);
}

/** Count an untracked file's lines as additions (null if binary/oversized). */
function countUntracked(cwd: string, rel: string): NumStat {
  const abs = resolveWithin(cwd, rel);
  if (!abs || !existsSync(abs)) return { added: null, removed: 0 };
  try {
    if (statSync(abs).size > MAX_DIFF_BYTES) return { added: null, removed: 0 };
    const buf = readFileSync(abs);
    if (hasNul(buf)) return { added: null, removed: 0 };
    const text = buf.toString("utf8");
    if (text === "") return { added: 0, removed: 0 };
    const lines = text.split("\n");
    // A trailing newline yields a phantom empty element — don't count it.
    const added = lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
    return { added, removed: 0 };
  } catch {
    return { added: null, removed: 0 };
  }
}

function hasNul(buf: Buffer): boolean {
  const len = Math.min(buf.length, 8000);
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}
