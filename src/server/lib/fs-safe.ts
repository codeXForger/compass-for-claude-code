import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve, sep } from "node:path";

/**
 * Resolve `segments` under `root` while guaranteeing the result stays inside
 * `root`. Returns the absolute path, or `null` if it escapes (a path-traversal
 * attempt such as a `..` segment). Used by route handlers to validate
 * user-supplied resource names before any read/write/delete.
 */
export function resolveWithin(
  root: string,
  ...segments: string[]
): string | null {
  const rootResolved = resolve(root);
  const target = resolve(rootResolved, ...segments);
  if (target !== rootResolved && !target.startsWith(rootResolved + sep)) {
    return null;
  }
  return target;
}

export function readJsonSafe<T = unknown>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

export function readTextSafe(path: string): string | null {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Backup the existing file (if any) to <backupsDir>/<basename>.<ts>.bak,
 * then atomically write the new contents.
 */
export function writeWithBackup(
  path: string,
  contents: string,
  backupsDir: string,
): { backedUpTo: string | null } {
  ensureDir(dirname(path));
  let backedUpTo: string | null = null;
  if (existsSync(path)) {
    ensureDir(backupsDir);
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    backedUpTo = resolve(backupsDir, `${basename(path)}.${ts}.bak`);
    copyFileSync(path, backedUpTo);
  }
  const tmp = `${path}.tmp.${process.pid}`;
  writeFileSync(tmp, contents, "utf8");
  // Atomic replace — fs.renameSync handles this cross-platform.
  renameSync(tmp, path);
  return { backedUpTo };
}

/**
 * Ensure `<cwd>/.gitignore` ignores `entry` (a path relative to cwd, e.g.
 * `CLAUDE.local.md` or `.claude/settings.local.json`). Idempotent: appends the
 * line only if no existing trimmed line already matches it. Used when writing
 * "local" config files so they never get committed.
 */
export function ensureGitignored(cwd: string, entry: string): void {
  const gitignore = resolve(cwd, ".gitignore");
  const existing = existsSync(gitignore) ? readFileSync(gitignore, "utf8") : "";
  const present = existing
    .split(/\r?\n/)
    .some((line) => line.trim() === entry);
  if (present) return;
  const prefix = existing.length && !existing.endsWith("\n") ? "\n" : "";
  writeFileSync(gitignore, `${existing}${prefix}${entry}\n`, "utf8");
}
