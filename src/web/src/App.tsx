import { NavLink, Route, Routes, Link, useLocation } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";
import { Setup } from "./pages/Setup";
import { Settings } from "./pages/Settings";
import { Skills } from "./pages/Skills";
import { Hooks } from "./pages/Hooks";
import { Commands } from "./pages/Commands";
import { Agents } from "./pages/Agents";
import { McpServers } from "./pages/McpServers";
import { Plugins } from "./pages/Plugins";
import { Tools } from "./pages/Tools";
import { Permissions } from "./pages/Permissions";
import { ClaudeMd } from "./pages/ClaudeMd";
import { History } from "./pages/History";
import { Files } from "./pages/Files";
import { GitStatus } from "./pages/GitStatus";
import { StatusProvider, useStatus, type AuthState } from "./components/StatusProvider";
import { SetupGate } from "./components/SetupGate";
import { ThemeToggle } from "./components/ThemeProvider";
import { ToastProvider } from "./components/ToastProvider";

interface NavItem {
  to: string;
  label: string;
  glyph: string;
  num: string;
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", num: "I", glyph: "✦" },
  { to: "/claudemd", label: "CLAUDE.md", num: "II", glyph: "§" },
  { to: "/settings", label: "Settings", num: "III", glyph: "❖" },
  { to: "/skills", label: "Skills", num: "IV", glyph: "✶" },
  { to: "/hooks", label: "Hooks", num: "V", glyph: "↯" },
  { to: "/commands", label: "Commands", num: "VI", glyph: "/" },
  { to: "/agents", label: "Agents", num: "VII", glyph: "◉" },
  { to: "/mcp", label: "MCP Servers", num: "VIII", glyph: "⇄" },
  { to: "/permissions", label: "Permissions", num: "IX", glyph: "⚿" },
  { to: "/history", label: "History", num: "X", glyph: "≡" },
  { to: "/plugins", label: "Plugins", num: "XI", glyph: "⌬" },
  { to: "/tools", label: "Tools", num: "XII", glyph: "✦" },
  { to: "/files", label: "Files", num: "XIII", glyph: "§" },
  { to: "/git", label: "Git Status", num: "XIV", glyph: "≢" },
];

export function App() {
  return (
    <StatusProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </StatusProvider>
  );
}

function Shell() {
  const { phase, fast, authState, elapsedAuthMs, verifyLogin } = useStatus();
  const ready = phase === "ready";
  const needsInstall = phase === "needs-install";
  const claudeVer = fast?.claude.version?.replace(/\s*\(Claude Code\)$/, "") ?? "";

  return (
    <div className="flex h-full">
      <aside className="relative flex w-64 shrink-0 flex-col border-r border-rule bg-surface">
        {/* Decorative compass rose at the bottom */}
        <div
          aria-hidden
          className="compass-rose pointer-events-none absolute bottom-12 left-1/2 h-44 w-44 -translate-x-1/2 opacity-60"
        />

        <div className="relative px-5 pb-4 pt-6">
          <Link to="/" className="block">
            <div className="eyebrow">An Atlas for</div>
            <div className="font-display text-3xl leading-none text-ink">
              Compass
            </div>
            <div className="mt-0.5 font-display italic text-sm text-muted">
              for Claude Code
            </div>
          </Link>
          <div className="rule-dotted mt-4" />
        </div>

        <nav className="relative flex-1 overflow-y-auto px-3 pb-4">
          <div className="mb-2 px-3 eyebrow">Atlas</div>
          {NAV.map((item, i) => {
            const disabled = !ready;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                aria-disabled={disabled}
                tabIndex={disabled ? -1 : 0}
                title={disabled ? "Install Claude CLI first" : undefined}
                className={({ isActive }) =>
                  `nav-link group animate-fade-in ${
                    isActive ? "nav-link-active" : ""
                  } ${disabled ? "pointer-events-none opacity-40" : ""}`
                }
                style={{ animationDelay: `${i * 18}ms` }}
              >
                <span className="nav-glyph">{item.num}</span>
                <span className="flex-1">{item.label}</span>
                <span
                  aria-hidden
                  className="font-display text-base leading-none text-faint opacity-0 transition-opacity group-hover:opacity-100"
                >
                  {item.glyph}
                </span>
              </NavLink>
            );
          })}

          {needsInstall && (
            <NavLink
              to="/setup"
              className={({ isActive }) =>
                `nav-link mt-3 border border-ember/40 bg-ember/10 text-ember ${
                  isActive ? "nav-link-active" : ""
                }`
              }
            >
              <span className="nav-glyph text-ember">⚙</span>
              <span className="flex-1">Setup required</span>
            </NavLink>
          )}
        </nav>

        <div className="relative space-y-3 border-t border-rule bg-elev/60 px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="eyebrow">Theme</span>
            <ThemeToggle compact />
          </div>
          {ready ? (
            <AuthBadge
              state={authState}
              elapsedAuthMs={elapsedAuthMs}
              version={claudeVer}
              onRetry={verifyLogin}
            />
          ) : (
            <div className="pill-quiet w-full justify-center">
              <span className="dot bg-faint animate-pulse" />
              checking…
            </div>
          )}
        </div>
      </aside>

      <main className="relative flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-10 py-10">
          <AuthFailedBanner />
          <SetupGate>
            <PageTransition>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/setup" element={<Setup />} />
                <Route path="/claudemd" element={<ClaudeMd />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/skills" element={<Skills />} />
                <Route path="/hooks" element={<Hooks />} />
                <Route path="/commands" element={<Commands />} />
                <Route path="/agents" element={<Agents />} />
                <Route path="/mcp" element={<McpServers />} />
                <Route path="/permissions" element={<Permissions />} />
                <Route path="/history" element={<History />} />
                <Route path="/plugins" element={<Plugins />} />
                <Route path="/tools" element={<Tools />} />
                <Route path="/files" element={<Files />} />
                <Route path="/git" element={<GitStatus />} />
              </Routes>
            </PageTransition>
          </SetupGate>
        </div>
      </main>
    </div>
  );
}

function PageTransition({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  return (
    <div key={loc.pathname} className="animate-page-in">
      {children}
    </div>
  );
}

function AuthBadge({
  state,
  elapsedAuthMs,
  version,
  onRetry,
}: {
  state: AuthState;
  elapsedAuthMs: number;
  version: string;
  onRetry: () => void;
}) {
  if (state.kind === "verified") {
    return (
      <Link
        to="/setup"
        className="pill-sage w-full justify-center"
        title="Verified just now — click to re-run setup"
      >
        <span className="dot bg-sage" />
        Claude {version} verified
      </Link>
    );
  }
  if (state.kind === "verifying") {
    return (
      <div
        className="pill-quiet w-full justify-center"
        title="Background login verification in progress"
      >
        <span className="dot bg-brass animate-pulse" />
        verifying… {(elapsedAuthMs / 1000).toFixed(0)}s
      </div>
    );
  }
  if (state.kind === "failed") {
    return (
      <Link
        to="/setup"
        className="pill-brick w-full justify-center"
        title={state.message}
      >
        <span className="dot bg-brick" />
        login failed · setup
      </Link>
    );
  }
  return (
    <button
      onClick={onRetry}
      className="pill-quiet w-full justify-center hover:bg-sunken"
      title={state.reason}
    >
      <span className="dot bg-sage" />
      Claude {version} · verify
    </button>
  );
}

function AuthFailedBanner() {
  const { authState, verifyLogin } = useStatus();
  if (authState.kind !== "failed") return null;
  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-md border border-brick/40 bg-brick/10 p-4">
      <div className="flex-1">
        <div className="text-sm font-medium text-ink">
          Claude login failed verification
        </div>
        <div className="mt-1 text-xs text-brick">{authState.message}</div>
      </div>
      <button className="btn-ghost" onClick={verifyLogin}>
        Re-check
      </button>
      <Link to="/setup" className="btn-primary">
        Open Setup
      </Link>
    </div>
  );
}
