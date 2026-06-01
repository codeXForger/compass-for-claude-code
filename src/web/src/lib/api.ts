const base = "";

export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(`${base}/api${path}`);
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${base}/api${path}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`PUT ${path} → ${r.status}: ${text}`);
  }
  return r.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${base}/api${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`POST ${path} → ${r.status}: ${text}`);
  }
  return r.json() as Promise<T>;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const r = await fetch(`${base}/api${path}`, { method: "DELETE" });
  if (!r.ok) throw new Error(`DELETE ${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

// --- Status types ---

export interface FastStatus {
  claude: {
    installed: boolean;
    path: string | null;
    version: string | null;
  };
  paths: {
    cwd: string;
    projectClaudeDir: string;
    projectSettings: string;
    projectClaudemd: string;
    userClaudeDir: string;
    userSettings: string;
    projectHistoryDir: string;
    projectMcp: string;
  };
  flags: {
    hasClaudeDir: boolean;
    hasClaudemd: boolean;
    hasMcpJson: boolean;
    hasHistory: boolean;
  };
}

export interface AuthStatus {
  loggedIn: boolean;
  authMessage: string | null;
  checkedAtMs: number;
}

// --- Dashboard summary types ---

export interface DashboardSession {
  id: string;
  file: string;
  mtimeMs: number;
  firstUserPrompt: string | null;
  eventCount: number;
}

export interface DashboardSummary {
  project: { name: string; cwd: string };
  counts: {
    skills: { project: number; user: number };
    commands: { project: number; user: number };
    agents: { project: number; user: number };
    mcpServers: { project: number; user: number };
    sessions: number;
    permissions: {
      projectAllow: number;
      projectDeny: number;
      userAllow: number;
      userDeny: number;
    };
  };
  recentSessions: DashboardSession[];
  latestSession: DashboardSession | null;
  claudemd: { exists: boolean; preview: string | null; path: string };
  flags: {
    hasClaudeDir: boolean;
    hasClaudemd: boolean;
    hasMcpJson: boolean;
    hasHistory: boolean;
    hasProjectSettings: boolean;
  };
}

export function getStatus(): Promise<FastStatus> {
  return apiGet<FastStatus>("/status");
}
export function getAuth(force = false): Promise<AuthStatus> {
  return apiGet<AuthStatus>(`/status/auth${force ? "?force=1" : ""}`);
}
export function getDashboardSummary(): Promise<DashboardSummary> {
  return apiGet<DashboardSummary>("/dashboard/summary");
}

/** The target project's display name — the basename of its cwd. */
export function projectNameFromCwd(cwd: string | undefined | null): string {
  if (!cwd) return "";
  return cwd.replace(/[/\\]+$/, "").split(/[/\\]/).pop() || cwd;
}
