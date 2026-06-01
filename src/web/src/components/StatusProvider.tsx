import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  getAuth,
  getStatus,
  type AuthStatus,
  type FastStatus,
} from "../lib/api";

export type StatusPhase =
  | "loading-fast"
  | "ready"
  | "needs-install"
  | "error";

export type AuthState =
  | { kind: "assumed"; reason: string } // claude installed → assume logged in
  | { kind: "verifying"; startedAtMs: number } // background verify in flight
  | { kind: "verified"; checkedAtMs: number } // real check succeeded
  | { kind: "failed"; message: string; checkedAtMs: number }; // real check failed with auth-style error

interface StatusContextValue {
  fast: FastStatus | null;
  auth: AuthStatus | null;
  authState: AuthState;
  phase: StatusPhase;
  elapsedAuthMs: number;
  error: string | null;
  refresh: (forceAuth?: boolean) => Promise<void>;
  verifyLogin: () => Promise<void>;
}

const Ctx = createContext<StatusContextValue | null>(null);

export function useStatus(): StatusContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStatus must be used inside <StatusProvider>");
  return v;
}

function derivePhase(fast: FastStatus | null): StatusPhase {
  if (!fast) return "loading-fast";
  if (!fast.claude.installed) return "needs-install";
  return "ready";
}

const AUTH_VERIFY_FAILURE_RE =
  /not logged in|setup[- ]?token|unauthorized|authenticate|please log in|login required/i;

export function StatusProvider({ children }: { children: React.ReactNode }) {
  const [fast, setFast] = useState<FastStatus | null>(null);
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [authState, setAuthState] = useState<AuthState>({
    kind: "assumed",
    reason: "Claude installed — login will be verified in the background.",
  });
  const [error, setError] = useState<string | null>(null);
  const [elapsedAuthMs, setElapsedAuthMs] = useState(0);
  const tickerRef = useRef<number | null>(null);
  const authStartRef = useRef<number | null>(null);

  const startTicker = useCallback(() => {
    if (tickerRef.current !== null) return;
    authStartRef.current = Date.now();
    setElapsedAuthMs(0);
    tickerRef.current = window.setInterval(() => {
      if (authStartRef.current !== null) {
        setElapsedAuthMs(Date.now() - authStartRef.current);
      }
    }, 250);
  }, []);

  const stopTicker = useCallback(() => {
    if (tickerRef.current !== null) {
      window.clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    authStartRef.current = null;
  }, []);

  // Background, non-blocking verify. Updates authState in place.
  const verifyLogin = useCallback(async () => {
    const startedAtMs = Date.now();
    setAuthState({ kind: "verifying", startedAtMs });
    startTicker();
    try {
      const result = await getAuth(true);
      stopTicker();
      setAuth(result);
      if (result.loggedIn) {
        setAuthState({ kind: "verified", checkedAtMs: result.checkedAtMs });
      } else if (
        result.authMessage &&
        AUTH_VERIFY_FAILURE_RE.test(result.authMessage)
      ) {
        setAuthState({
          kind: "failed",
          message: result.authMessage,
          checkedAtMs: result.checkedAtMs,
        });
      } else {
        // Timeout or other transient — revert to assumed.
        setAuthState({
          kind: "assumed",
          reason:
            result.authMessage ??
            "Could not verify login (timeout). Claude is probably still working.",
        });
      }
    } catch (e) {
      stopTicker();
      setAuthState({
        kind: "assumed",
        reason: `Verification request failed: ${String(e)}`,
      });
    }
  }, [startTicker, stopTicker]);

  const refresh = useCallback(
    async (forceAuth = false) => {
      setError(null);
      try {
        const fastResult = await getStatus();
        setFast(fastResult);
        if (!fastResult.claude.installed) {
          // Definitive: no claude binary.
          setAuth({
            loggedIn: false,
            authMessage: "claude CLI not found in PATH",
            checkedAtMs: Date.now(),
          });
          setAuthState({
            kind: "failed",
            message: "claude CLI not found in PATH",
            checkedAtMs: Date.now(),
          });
          return;
        }
        // Claude installed → optimistically ready. Fire background verify.
        setAuthState((prev) =>
          prev.kind === "verified" ? prev : {
            kind: "assumed",
            reason: "Claude installed — login verification running in background.",
          },
        );
        if (forceAuth) {
          await verifyLogin();
        } else {
          // Don't await — let the user use the app while we verify.
          verifyLogin();
        }
      } catch (e) {
        setError(String(e));
      }
    },
    [verifyLogin],
  );

  useEffect(() => {
    refresh();
    return () => stopTicker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const phase: StatusPhase = error ? "error" : derivePhase(fast);

  return (
    <Ctx.Provider
      value={{
        fast,
        auth,
        authState,
        phase,
        elapsedAuthMs,
        error,
        refresh,
        verifyLogin,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
