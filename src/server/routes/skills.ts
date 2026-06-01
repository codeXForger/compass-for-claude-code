import { Hono } from "hono";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import type { ServerContext } from "../index.js";
import { resolveWithin, writeWithBackup } from "../lib/fs-safe.js";
import { resolvePaths } from "../lib/paths.js";

type Scope = "project" | "user";

interface SkillEntry {
  name: string;
  scope: Scope;
  path: string;
  hasSkillMd: boolean;
}

interface SkillFile {
  path: string;
  size: number;
  executable: boolean;
}

function skillsDir(ctx: ServerContext, scope: Scope): string {
  const p = resolvePaths(ctx.cwd);
  return scope === "project"
    ? join(p.projectClaudeDir, "skills")
    : join(p.userClaudeDir, "skills");
}

/** Recursively list files inside a skill dir (skipping SKILL.md and dotfiles). */
function walkFiles(root: string, dir = root, acc: SkillFile[] = []): SkillFile[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(root, full, acc);
      continue;
    }
    if (entry.name === "SKILL.md" && dir === root) continue;
    const st = statSync(full);
    acc.push({
      path: relative(root, full).split(sep).join("/"),
      size: st.size,
      executable: (st.mode & 0o111) !== 0,
    });
  }
  return acc;
}

function listScope(ctx: ServerContext, scope: Scope): SkillEntry[] {
  const dir = skillsDir(ctx, scope);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory();
    })
    .map((name) => {
      const skillPath = join(dir, name);
      const skillMd = join(skillPath, "SKILL.md");
      return {
        name,
        scope,
        path: skillPath,
        hasSkillMd: existsSync(skillMd),
      };
    });
}

export function skillsRoute(ctx: ServerContext) {
  const app = new Hono();

  app.get("/", (c) => {
    return c.json({
      project: listScope(ctx, "project"),
      user: listScope(ctx, "user"),
    });
  });

  app.get("/:scope/:name", (c) => {
    const scope = c.req.param("scope") as Scope;
    const dir = resolveWithin(skillsDir(ctx, scope), c.req.param("name"));
    if (!dir) return c.json({ error: "refused: path traversal" }, 400);
    const skillMd = join(dir, "SKILL.md");
    if (!existsSync(skillMd)) return c.json({ error: "not found" }, 404);
    return c.json({ path: skillMd, content: readFileSync(skillMd, "utf8") });
  });

  app.put("/:scope/:name", async (c) => {
    const scope = c.req.param("scope") as Scope;
    const dir = resolveWithin(skillsDir(ctx, scope), c.req.param("name"));
    if (!dir) return c.json({ error: "refused: path traversal" }, 400);
    const { content } = await c.req.json<{ content: string }>();
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "SKILL.md");
    writeFileSync(file, content, "utf8");
    return c.json({ ok: true, path: file });
  });

  app.delete("/:scope/:name", (c) => {
    const scope = c.req.param("scope") as Scope;
    const dir = resolveWithin(skillsDir(ctx, scope), c.req.param("name"));
    if (!dir) return c.json({ error: "refused: path traversal" }, 400);
    if (!existsSync(dir)) return c.json({ error: "not found" }, 404);
    rmSync(dir, { recursive: true, force: true });
    return c.json({ ok: true });
  });

  // --- Resource & script files inside a skill directory ---

  /** Resolve a skill dir + a relative file path, guarding traversal/SKILL.md. */
  function resolveSkillFile(scope: Scope, name: string, rel: string) {
    const skillDir = resolveWithin(skillsDir(ctx, scope), name);
    if (!skillDir) return { error: "refused: path traversal" as const };
    const file = resolveWithin(skillDir, rel);
    if (!file) return { error: "refused: path traversal" as const };
    if (file === join(skillDir, "SKILL.md"))
      return { error: "use the skill editor for SKILL.md" as const };
    return { skillDir, file };
  }

  app.get("/:scope/:name/files", (c) => {
    const scope = c.req.param("scope") as Scope;
    const dir = resolveWithin(skillsDir(ctx, scope), c.req.param("name"));
    if (!dir) return c.json({ error: "refused: path traversal" }, 400);
    return c.json({ files: walkFiles(dir) });
  });

  app.get("/:scope/:name/files/:rel{.+}", (c) => {
    const scope = c.req.param("scope") as Scope;
    const r = resolveSkillFile(scope, c.req.param("name"), c.req.param("rel"));
    if ("error" in r) return c.json({ error: r.error }, 400);
    if (!existsSync(r.file) || !statSync(r.file).isFile())
      return c.json({ error: "not found" }, 404);
    const st = statSync(r.file);
    if (st.size > 2 * 1024 * 1024)
      return c.json({ error: "file too large (>2MB)" }, 413);
    const buf = readFileSync(r.file);
    if (buf.includes(0)) return c.json({ error: "binary file" }, 415);
    return c.json({
      content: buf.toString("utf8"),
      executable: (st.mode & 0o111) !== 0,
    });
  });

  app.put("/:scope/:name/files/:rel{.+}", async (c) => {
    const scope = c.req.param("scope") as Scope;
    const r = resolveSkillFile(scope, c.req.param("name"), c.req.param("rel"));
    if ("error" in r) return c.json({ error: r.error }, 400);
    const { content, executable } = await c.req.json<{
      content: string;
      executable?: boolean;
    }>();
    mkdirSync(dirname(r.file), { recursive: true });
    const { projectBackupsDir } = resolvePaths(ctx.cwd);
    writeWithBackup(r.file, content, projectBackupsDir);
    chmodSync(r.file, executable ? 0o755 : 0o644);
    return c.json({ ok: true, path: r.file, executable: !!executable });
  });

  app.delete("/:scope/:name/files/:rel{.+}", (c) => {
    const scope = c.req.param("scope") as Scope;
    const r = resolveSkillFile(scope, c.req.param("name"), c.req.param("rel"));
    if ("error" in r) return c.json({ error: r.error }, 400);
    if (!existsSync(r.file)) return c.json({ error: "not found" }, 404);
    unlinkSync(r.file);
    return c.json({ ok: true });
  });

  return app;
}
