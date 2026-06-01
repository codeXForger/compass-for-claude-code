import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStatus } from "../components/StatusProvider";
import { useTheme } from "../components/ThemeProvider";
import { PageHeader } from "../components/PageHeader";

export function Setup() {
  const { fast, authState, elapsedAuthMs, verifyLogin } = useStatus();
  const { resolved } = useTheme();
  const termRef = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const navigate = useNavigate();

  const installed = fast?.claude.installed ?? false;
  const version = fast?.claude.version ?? null;

  useEffect(() => {
    if (installed && authState.kind === "verified") {
      const t = setTimeout(() => navigate("/"), 800);
      return () => clearTimeout(t);
    }
  }, [installed, authState.kind, navigate]);

  async function startSetupToken() {
    const { Terminal } = await import("@xterm/xterm");
    const { FitAddon } = await import("@xterm/addon-fit");
    await import("@xterm/xterm/css/xterm.css");

    const term = new Terminal({
      fontFamily: '"Geist Mono", ui-monospace, Menlo, monospace',
      fontSize: 13,
      theme: {
        background: resolved === "dark" ? "#0c0b09" : "#f0e8d9",
        foreground: resolved === "dark" ? "#ece4d4" : "#201c16",
        cursor: resolved === "dark" ? "#d4a260" : "#a16d2f",
      },
      cursorBlink: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    if (termRef.current) {
      termRef.current.innerHTML = "";
      term.open(termRef.current);
      fit.fit();
    }

    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/api/pty`);
    wsRef.current = ws;
    setRunning(true);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "start",
          command: "claude-setup",
          cols: term.cols,
          rows: term.rows,
        }),
      );
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data !== "string") return;
      if (ev.data.startsWith("{")) {
        try {
          const obj = JSON.parse(ev.data);
          if (obj.type === "exit") {
            term.writeln(
              `\r\n\x1b[33m[process exited with code ${obj.code}]\x1b[0m`,
            );
            setRunning(false);
            verifyLogin();
            return;
          }
          if (obj.type === "error") {
            term.writeln(`\r\n\x1b[31m[error] ${obj.message}\x1b[0m`);
            setRunning(false);
            return;
          }
        } catch {
          /* fall through */
        }
      }
      term.write(ev.data);
    };
    ws.onclose = () => setRunning(false);

    term.onData((d) => ws.send(d));
    window.addEventListener("resize", () => {
      fit.fit();
      ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
    });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        chapter="○"
        eyebrow="Prelude · Setup"
        title="First, find your bearings"
        subtitle="Install Claude Code · sign in · set sail"
      />

      {!installed ? (
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <span className="dot bg-ember" />
            <h2 className="font-display text-2xl text-ink">
              Claude CLI not found
            </h2>
          </div>
          <p className="text-sm text-muted">
            Install it with one of the following:
          </p>
          <pre className="code-block">
{`# npm (recommended)
npm i -g @anthropic-ai/claude-code

# or via the official installer
curl -fsSL https://claude.ai/install.sh | sh`}
          </pre>
          <button className="btn-primary mt-2" onClick={() => verifyLogin()}>
            I've installed it — re-check
          </button>
        </div>
      ) : (
        <>
          <div className="card space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="eyebrow">Claude binary</div>
                <div className="mt-1 font-display text-2xl text-ink">
                  Claude {version}
                </div>
                <div className="mt-1 font-mono text-[11px] text-faint">
                  {fast?.claude.path}
                </div>
              </div>
              <StateBadge state={authState} elapsedAuthMs={elapsedAuthMs} />
            </div>

            {(authState.kind === "assumed" ||
              authState.kind === "verifying" ||
              authState.kind === "failed") && (
              <div className="rounded-md border border-rule bg-sunken p-3 text-xs text-muted">
                {authState.kind === "assumed" && authState.reason}
                {authState.kind === "verifying" &&
                  `Running claude --print under the hood. ${(elapsedAuthMs / 1000).toFixed(0)}s elapsed. This can take up to a minute on a cold start with plugins loaded.`}
                {authState.kind === "failed" && authState.message}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                className="btn-primary"
                onClick={() => verifyLogin()}
                disabled={authState.kind === "verifying"}
              >
                {authState.kind === "verifying"
                  ? "Verifying…"
                  : "Verify login now"}
              </button>
            </div>
          </div>

          {authState.kind === "failed" && (
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <span className="dot bg-ember" />
                <h2 className="font-display text-2xl text-ink">
                  Log in via embedded terminal
                </h2>
              </div>
              <p className="text-sm text-muted">
                Starts <code className="font-mono text-ink">claude setup-token</code>{" "}
                in an embedded terminal. A browser tab opens for OAuth.
              </p>
              {!running && (
                <button onClick={startSetupToken} className="btn-primary">
                  Start login
                </button>
              )}
              <div
                ref={termRef}
                className="h-72 rounded-md border border-rule bg-sunken p-2"
              />
              <p className="text-[11px] text-faint">
                If browser OAuth doesn't open, run{" "}
                <code className="font-mono text-muted">claude setup-token</code>{" "}
                in your own terminal, then click "Verify login now" above.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StateBadge({
  state,
  elapsedAuthMs,
}: {
  state: ReturnType<typeof useStatus>["authState"];
  elapsedAuthMs: number;
}) {
  if (state.kind === "verified")
    return (
      <span className="pill-sage">
        <span className="dot bg-sage" />
        Verified
      </span>
    );
  if (state.kind === "verifying")
    return (
      <span className="pill-quiet">
        <span className="dot bg-brass animate-pulse" />
        verifying… {(elapsedAuthMs / 1000).toFixed(0)}s
      </span>
    );
  if (state.kind === "failed")
    return (
      <span className="pill-brick">
        <span className="dot bg-brick" />
        Failed
      </span>
    );
  return (
    <span className="pill-quiet">
      <span className="dot bg-faint" />
      Assumed OK
    </span>
  );
}
