import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export interface FastClaudeStatus {
  installed: boolean;
  path: string | null;
  version: string | null;
}

export interface AuthStatus {
  loggedIn: boolean;
  authMessage: string | null;
  checkedAtMs: number;
}

const AUTH_TTL_MS = 5 * 60 * 1000;
let authCache: AuthStatus | null = null;
let inFlightAuth: Promise<AuthStatus> | null = null;

export function clearAuthCache(): void {
  authCache = null;
}

/**
 * Kick off the auth check immediately without blocking. The result lands in the
 * cache (or in-flight promise) so the first /api/status/auth request reuses it.
 * Call this on server boot to overlap auth detection with browser loading.
 */
export function prewarmAuth(): void {
  if (authCache || inFlightAuth) return;
  inFlightAuth = doAuthCheck();
  inFlightAuth.catch(() => {
    /* swallow; checkAuth() will retry */
  });
}

export async function detectClaudeFast(): Promise<FastClaudeStatus> {
  let path: string | null = null;
  try {
    const which = await exec(process.platform === "win32" ? "where" : "which", [
      "claude",
    ]);
    path = which.stdout.trim().split(/\r?\n/)[0] || null;
  } catch {
    return { installed: false, path: null, version: null };
  }

  let version: string | null = null;
  try {
    const v = await exec("claude", ["--version"], { timeout: 5000 });
    version = v.stdout.trim();
  } catch {
    /* installed but errored — leave version null */
  }

  return { installed: true, path, version };
}

export async function checkAuth(force = false): Promise<AuthStatus> {
  if (!force && authCache && Date.now() - authCache.checkedAtMs < AUTH_TTL_MS) {
    return authCache;
  }
  // De-dupe concurrent callers — they share one in-flight subprocess.
  if (!force && inFlightAuth) {
    return inFlightAuth;
  }
  inFlightAuth = doAuthCheck();
  return inFlightAuth;
}

async function doAuthCheck(): Promise<AuthStatus> {
  try {
    return await runAuthCheck();
  } finally {
    inFlightAuth = null;
  }
}

async function runAuthCheck(): Promise<AuthStatus> {
  try {
    await exec("claude", ["--print", "ok", "--output-format", "text"], {
      timeout: 60000,
    });
    authCache = { loggedIn: true, authMessage: null, checkedAtMs: Date.now() };
    return authCache;
  } catch (err) {
    const e = err as {
      stderr?: string;
      stdout?: string;
      message?: string;
      killed?: boolean;
      signal?: string;
      code?: number | string;
    };
    const msg =
      (e.stderr || e.stdout || e.message || "auth check failed").trim() ||
      "auth check failed";

    // Distinguish "definitely logged out" from "we don't know yet".
    // Logged-out errors mention login/setup/unauthorized.
    const looksLikeAuthFailure =
      /not logged in|setup[- ]?token|unauthorized|authenticate|please log in|login required/i.test(
        msg,
      );

    // Timeouts and signal kills are transient — don't poison the cache.
    const isTransient = e.killed === true || e.signal === "SIGTERM" || /etimedout|timeout/i.test(msg);

    if (looksLikeAuthFailure) {
      authCache = {
        loggedIn: false,
        authMessage: msg,
        checkedAtMs: Date.now(),
      };
      return authCache;
    }

    if (isTransient) {
      // Do not cache. Return an "unknown" result that the UI can re-poll.
      return {
        loggedIn: false,
        authMessage: `Auth check timed out — Claude took too long to respond. This is not a definitive logout. Click "Re-check" to try again.`,
        checkedAtMs: Date.now(),
      };
    }

    // Other errors: cache briefly so we don't hammer claude.
    authCache = {
      loggedIn: false,
      authMessage: msg,
      checkedAtMs: Date.now(),
    };
    return authCache;
  }
}
