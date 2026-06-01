import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStatus } from "../components/StatusProvider";
import { PageHeader } from "../components/PageHeader";
import {
  getDashboardSummary,
  type DashboardSummary,
} from "../lib/api";

function fmtRelative(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 0) return "just now";
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

export function Dashboard() {
  const { fast } = useStatus();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getDashboardSummary().then(setData).catch((e) => setErr(String(e)));
  }, []);

  if (err)
    return (
      <div className="rounded-md border border-brick/40 bg-brick/10 p-4 text-brick">
        Error: {err}
      </div>
    );
  if (!data || !fast) return <DashboardSkeleton />;

  const c = data.counts;
  const claudeVersion = (fast.claude.version ?? "unknown").replace(
    /\s*\(Claude Code\)$/,
    "",
  );

  return (
    <div className="space-y-10">
      <PageHeader
        chapter="I"
        eyebrow="Chapter · Dashboard"
        title={data.project.name}
        subtitle={<>at the intersection of <em>code</em> &amp; <em>compass</em></>}
        meta={`◉ ${data.project.cwd}`}
        actions={
          <div className="pill-sage">
            <span className="dot bg-sage" />
            Connected · Claude {claudeVersion}
          </div>
        }
      />

      {/* KPIs */}
      <section>
        <div className="mb-3 eyebrow">By the numbers</div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Kpi label="Skills" value={c.skills.project + c.skills.user}
            sub={`${c.skills.project} project · ${c.skills.user} user`}
            to="/skills" />
          <Kpi label="Commands" value={c.commands.project + c.commands.user}
            sub={`${c.commands.project} project · ${c.commands.user} user`}
            to="/commands" />
          <Kpi label="Agents" value={c.agents.project + c.agents.user}
            sub={`${c.agents.project} project · ${c.agents.user} user`}
            to="/agents" />
          <Kpi label="MCP Servers" value={c.mcpServers.project + c.mcpServers.user}
            sub={`${c.mcpServers.project} project · ${c.mcpServers.user} user`}
            to="/mcp" />
          <Kpi label="Sessions" value={c.sessions} sub="this project"
            to="/history" />
        </div>
      </section>

      {/* Quick actions */}
      <section>
        <div className="mb-3 eyebrow">Quick passage</div>
        <div className="flex flex-wrap gap-2">
          <Link to="/claudemd" className="btn-primary">
            {data.claudemd.exists ? "View CLAUDE.md" : "Generate CLAUDE.md"}
          </Link>
          <Link to="/settings" className="btn-ghost">Edit settings</Link>
          <Link to="/mcp" className="btn-ghost">Add MCP server</Link>
          {data.latestSession && (
            <button
              className="btn-ghost"
              onClick={() => navigate(`/history`)}
            >
              Open latest session
            </button>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* CLAUDE.md preview */}
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="chapter-num text-xl">§</span>
              <h2 className="font-display text-2xl text-ink">CLAUDE.md</h2>
            </div>
            {data.claudemd.exists ? (
              <Link to="/claudemd" className="font-display italic text-sm text-brass hover:underline">
                View full →
              </Link>
            ) : (
              <span className="pill-ember">
                <span className="dot bg-ember" /> Not present
              </span>
            )}
          </div>
          {data.claudemd.exists ? (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-rule bg-sunken p-3 font-mono text-[11.5px] leading-relaxed text-muted">
              {data.claudemd.preview}
            </pre>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                No CLAUDE.md in this project. Generate one with Claude — or start
                with a blank chart.
              </p>
              <Link to="/claudemd" className="btn-primary inline-flex">
                Generate CLAUDE.md
              </Link>
            </div>
          )}
        </div>

        {/* Recent sessions */}
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="chapter-num text-xl">≡</span>
              <h2 className="font-display text-2xl text-ink">Recent sessions</h2>
            </div>
            <Link to="/history" className="font-display italic text-sm text-brass hover:underline">
              All →
            </Link>
          </div>
          {data.recentSessions.length === 0 ? (
            <div className="text-sm text-muted">
              No prior Claude sessions in this project.
            </div>
          ) : (
            <ul className="-mx-1 space-y-1">
              {data.recentSessions.map((s, i) => (
                <li key={s.id}>
                  <Link
                    to="/history"
                    className="block rounded-md px-2 py-2 transition-colors hover:bg-sunken animate-fade-in"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div className="flex items-center justify-between text-faint">
                      <span className="font-mono text-[11px]">
                        {s.id.slice(0, 10)}…
                      </span>
                      <span className="font-display italic text-[11px]">
                        {fmtRelative(s.mtimeMs)}
                      </span>
                    </div>
                    {s.firstUserPrompt && (
                      <div className="mt-1 line-clamp-2 text-[13px] text-muted">
                        {s.firstUserPrompt}
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Setup health */}
      <section className="card">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="eyebrow">Survey · Setup health</h2>
          <span className="font-mono text-[11px] text-faint">
            {data.project.cwd}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs">
          <HealthDot ok={data.flags.hasClaudeDir} label=".claude/" />
          <HealthDot ok={data.flags.hasClaudemd} label="CLAUDE.md" />
          <HealthDot ok={data.flags.hasMcpJson} label=".mcp.json" />
          <HealthDot ok={data.flags.hasProjectSettings} label="settings.json" />
          <HealthDot ok={data.flags.hasHistory} label="history" />
          <HealthDot ok={true} label="claude logged in" />
        </div>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  to,
}: {
  label: string;
  value: number;
  sub: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="card group block transition-all hover:border-brass/60 hover:-translate-y-0.5"
    >
      <div className="eyebrow">{label}</div>
      <div className="mt-2 font-display text-5xl leading-none text-ink transition-colors group-hover:text-brass">
        {value}
      </div>
      <div className="mt-2 font-mono text-[10.5px] text-faint">{sub}</div>
    </Link>
  );
}

function HealthDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`dot ${ok ? "bg-sage" : "bg-brick"} ${ok ? "shadow-[0_0_0_3px_rgb(var(--sage)/0.15)]" : "shadow-[0_0_0_3px_rgb(var(--brick)/0.15)]"}`}
      />
      <span className={`font-mono text-[11.5px] ${ok ? "text-ink" : "text-faint"}`}>
        {label}
      </span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="h-3 w-20 animate-pulse rounded bg-rule" />
        <div className="h-10 w-1/3 animate-pulse rounded bg-rule" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card h-28 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="card h-56 animate-pulse" />
        <div className="card h-56 animate-pulse" />
      </div>
    </div>
  );
}
