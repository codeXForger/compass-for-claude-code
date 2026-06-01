import { homedir } from "node:os";
import { resolve } from "node:path";

export interface ResolvedPaths {
  cwd: string;
  projectClaudeDir: string;
  projectSettings: string;
  projectSettingsLocal: string;
  projectMcp: string;
  projectClaudemd: string;
  projectBackupsDir: string;
  userClaudeDir: string;
  userSettings: string;
  userSettingsLocal: string;
  userClaudeJson: string;
  projectHistoryDir: string;
}

/**
 * Encode a cwd path into the directory name Claude Code uses inside
 * ~/.claude/projects/. Convention: replace path separators and dots with `-`.
 */
export function encodeProjectDir(cwd: string): string {
  return cwd.replace(/[/.]/g, "-");
}

export function resolvePaths(cwd: string): ResolvedPaths {
  const home = homedir();
  const projectClaudeDir = resolve(cwd, ".claude");
  const userClaudeDir = resolve(home, ".claude");
  return {
    cwd,
    projectClaudeDir,
    projectSettings: resolve(projectClaudeDir, "settings.json"),
    projectSettingsLocal: resolve(projectClaudeDir, "settings.local.json"),
    projectMcp: resolve(cwd, ".mcp.json"),
    projectClaudemd: resolve(cwd, "CLAUDE.md"),
    projectBackupsDir: resolve(projectClaudeDir, ".compass-backups"),
    userClaudeDir,
    userSettings: resolve(userClaudeDir, "settings.json"),
    userSettingsLocal: resolve(userClaudeDir, "settings.local.json"),
    userClaudeJson: resolve(home, ".claude.json"),
    projectHistoryDir: resolve(userClaudeDir, "projects", encodeProjectDir(cwd)),
  };
}
