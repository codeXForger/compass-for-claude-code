import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { useToast } from "../components/ToastProvider";

type Scope = "project" | "user" | "local";
type Verdict = "allow" | "ask" | "deny" | "none";

interface ToolEntry {
  name: string;
  description: string;
  pattern: string;
  verdicts: { project: Verdict; user: Verdict; local: Verdict };
}

interface ToolsResponse {
  tools: ToolEntry[];
  permissions: {
    project: { allow?: string[]; ask?: string[]; deny?: string[] };
    user: { allow?: string[]; ask?: string[]; deny?: string[] };
    local: { allow?: string[]; ask?: string[]; deny?: string[] };
  };
}

const VERDICTS: { v: Verdict; label: string; tone: string }[] = [
  { v: "allow", label: "Allow", tone: "sage" },
  { v: "ask", label: "Ask", tone: "ember" },
  { v: "deny", label: "Deny", tone: "brick" },
  { v: "none", label: "Default", tone: "quiet" },
];

export function Tools() {
  const [data, setData] = useState<ToolsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>("project");
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const toast = useToast();

  function refresh() {
    setErr(null);
    apiGet<ToolsResponse>("/tools")
      .then(setData)
      .catch((e) => setErr(String(e)));
  }
  useEffect(refresh, []);

  async function setVerdict(t: ToolEntry, verdict: Verdict) {
    const key = `${t.pattern}:${scope}`;
    setBusy(key);
    setErr(null);
    try {
      await apiPost(`/tools/set`, {
        scope,
        pattern: t.pattern,
        verdict,
      });
      toast.success(
        verdict === "none"
          ? `${t.name}: reset to default in ${scope}.`
          : `${t.name}: set ${verdict} in ${scope}.`,
      );
      refresh();
    } catch (e) {
      toast.error(String(e).replace(/^Error:\s*/, ""));
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return data.tools;
    return data.tools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.pattern.toLowerCase().includes(q),
    );
  }, [data, filter]);

  return (
    <div className="space-y-6">
      <PageHeader
        chapter="XII"
        eyebrow="Chapter · Tools"
        title="Instruments of the trade"
        subtitle={
          <>
            built-in tools — permissions read from{" "}
            <code className="font-mono not-italic text-ink">settings.json</code>
          </>
        }
      />

      {err && (
        <div className="rounded-md border border-brick/40 bg-brick/10 p-3 text-sm text-brick">
          {err}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border border-rule bg-surface p-1">
          {(["project", "user", "local"] as Scope[]).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`tab capitalize ${scope === s ? "tab-active" : ""}`}
              title={s === "local" ? ".claude/settings.local.json" : undefined}
            >
              {s}
            </button>
          ))}
        </div>

        <input
          className="field max-w-xs flex-1"
          placeholder="Filter tools…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {!data ? (
        <div className="text-sm text-muted">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-rule bg-sunken p-6 text-center">
          <div className="font-display italic text-muted">
            No tools match this filter.
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((t, i) => {
            const v = t.verdicts[scope];
            return (
              <li
                key={t.pattern}
                className="rounded-md border border-rule bg-surface px-4 py-3 transition-colors hover:border-brass/40 animate-fade-in"
                style={{ animationDelay: `${i * 20}ms` }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-lg text-brass">✦</span>
                      <span className="font-mono text-sm text-ink">
                        {t.name}
                      </span>
                      <VerdictPill verdict={v} />
                    </div>
                    <div className="mt-1 text-[12px] text-muted">
                      {t.description}
                    </div>
                    <div className="mt-1 font-mono text-[10.5px] text-faint">
                      pattern · {t.pattern}
                    </div>
                    <div className="mt-1 flex gap-3 font-mono text-[10.5px] text-faint">
                      <span>
                        project:{" "}
                        <span className={verdictTextClass(t.verdicts.project)}>
                          {t.verdicts.project}
                        </span>
                      </span>
                      <span>
                        user:{" "}
                        <span className={verdictTextClass(t.verdicts.user)}>
                          {t.verdicts.user}
                        </span>
                      </span>
                      <span>
                        local:{" "}
                        <span className={verdictTextClass(t.verdicts.local)}>
                          {t.verdicts.local}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 flex-wrap gap-1">
                    {VERDICTS.map((opt) => {
                      const active = opt.v === v;
                      const key = `${t.pattern}:${scope}`;
                      const isBusy = busy === key;
                      return (
                        <button
                          key={opt.v}
                          onClick={() => !active && setVerdict(t, opt.v)}
                          disabled={isBusy || active}
                          className={
                            active
                              ? `pill-${opt.tone} text-[11px]`
                              : "btn-ghost text-[11px]"
                          }
                          title={
                            opt.v === "none"
                              ? "Remove from allow/ask/deny in this scope"
                              : `Set ${opt.v} in ${scope} scope`
                          }
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="card">
        <h2 className="eyebrow mb-2">How this works</h2>
        <ul className="ml-4 list-disc space-y-1 text-[12px] text-muted">
          <li>
            Verdict is computed from{" "}
            <code className="font-mono not-italic text-ink">
              permissions.allow / ask / deny
            </code>{" "}
            in the selected scope's{" "}
            <code className="font-mono not-italic text-ink">settings.json</code>
            . Precedence:{" "}
            <span className="text-brick">deny</span> &gt;{" "}
            <span className="text-ember">ask</span> &gt;{" "}
            <span className="text-sage">allow</span>.
          </li>
          <li>
            Quick-toggle writes the bare tool name (e.g.{" "}
            <code className="font-mono not-italic text-ink">Bash</code>). For
            sub-patterns like{" "}
            <code className="font-mono not-italic text-ink">Bash(git *)</code>{" "}
            or MCP-specific patterns like{" "}
            <code className="font-mono not-italic text-ink">mcp__server</code>,
            edit the Permissions page directly.
          </li>
        </ul>
      </div>
    </div>
  );
}

function VerdictPill({ verdict }: { verdict: Verdict }) {
  if (verdict === "allow")
    return (
      <span className="pill-sage text-[10px]">
        <span className="dot bg-sage" /> allow
      </span>
    );
  if (verdict === "ask")
    return (
      <span className="pill-ember text-[10px]">
        <span className="dot bg-ember" /> ask
      </span>
    );
  if (verdict === "deny")
    return (
      <span className="pill-brick text-[10px]">
        <span className="dot bg-brick" /> deny
      </span>
    );
  return (
    <span className="pill-quiet text-[10px]">
      <span className="dot bg-faint" /> default
    </span>
  );
}

function verdictTextClass(v: Verdict): string {
  if (v === "allow") return "text-sage";
  if (v === "ask") return "text-ember";
  if (v === "deny") return "text-brick";
  return "text-faint";
}
