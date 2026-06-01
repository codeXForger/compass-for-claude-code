import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPut } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { ActionButton } from "../components/ActionButton";
import { useToast } from "../components/ToastProvider";

type Scope = "project" | "user" | "local";
type Verdict = "allow" | "ask" | "deny";

interface PermissionsValue {
  allow?: string[];
  deny?: string[];
  ask?: string[];
}

interface Rule {
  pattern: string;
  verdict: Verdict;
}

const SCOPES: Scope[] = ["project", "user", "local"];

// `tone` keys the always-present `.pill-*` component classes (index.css).
// `text`/`border` are spelled out as full literals so Tailwind's content
// scanner keeps them — interpolated class names would be purged.
const VERDICTS: {
  v: Verdict;
  label: string;
  tone: string;
  text: string;
  border: string;
  hint: string;
}[] = [
  {
    v: "allow",
    label: "Allow",
    tone: "sage",
    text: "text-sage",
    border: "border-sage/30",
    hint: "Run without asking",
  },
  {
    v: "ask",
    label: "Ask",
    tone: "ember",
    text: "text-ember",
    border: "border-ember/30",
    hint: "Prompt before running",
  },
  {
    v: "deny",
    label: "Deny",
    tone: "brick",
    text: "text-brick",
    border: "border-brick/30",
    hint: "Block outright",
  },
];

// Plain-English tool catalogue for the guided builder. Mirrors the built-in
// tools the server knows about (src/server/routes/tools.ts) plus the two
// special composers: MCP servers and a free-form custom escape hatch.
type Qualifier = "command" | "path" | "domain" | "mcp" | "custom" | "none";
const TOOLS: { name: string; label: string; qualifier: Qualifier }[] = [
  { name: "Bash", label: "Bash — run shell commands", qualifier: "command" },
  { name: "Read", label: "Read — read files", qualifier: "path" },
  { name: "Write", label: "Write — create / overwrite files", qualifier: "path" },
  { name: "Edit", label: "Edit — edit files", qualifier: "path" },
  { name: "Glob", label: "Glob — match file paths", qualifier: "path" },
  { name: "Grep", label: "Grep — search file contents", qualifier: "path" },
  { name: "WebFetch", label: "WebFetch — fetch a URL", qualifier: "domain" },
  { name: "WebSearch", label: "WebSearch — search the web", qualifier: "none" },
  { name: "Task", label: "Task — launch subagents", qualifier: "none" },
  { name: "TodoWrite", label: "TodoWrite — manage the to-do list", qualifier: "none" },
  { name: "NotebookEdit", label: "NotebookEdit — edit notebooks", qualifier: "none" },
  { name: "__mcp__", label: "MCP server (mcp__…)", qualifier: "mcp" },
  { name: "__custom__", label: "Custom rule…", qualifier: "custom" },
];

const QUALIFIER_COPY: Record<
  Qualifier,
  { label: string; placeholder: string } | null
> = {
  command: { label: "Command match (blank = all commands)", placeholder: "git *" },
  path: { label: "Path match (blank = all paths)", placeholder: "./src/**" },
  domain: { label: "Domain", placeholder: "domain:example.com" },
  mcp: { label: "Server (+ optional tool)", placeholder: "vercel" },
  custom: { label: "Rule", placeholder: "Bash(git add:*)" },
  none: null,
};

const PRESETS: { label: string; pattern: string; verdict: Verdict }[] = [
  { label: "Allow git", pattern: "Bash(git *)", verdict: "allow" },
  { label: "Ask before rm", pattern: "Bash(rm *)", verdict: "ask" },
  { label: "Deny reading .env", pattern: "Read(./.env)", verdict: "deny" },
  { label: "Allow reading files", pattern: "Read", verdict: "allow" },
];

/** Flatten a stored {allow,ask,deny} block into one verdict-per-pattern list.
 *  When a pattern appears under several verdicts, keep the strictest
 *  (deny > ask > allow) — matching the server's precedence — and flag it. */
function flatten(v: PermissionsValue): { rules: Rule[]; hadConflict: boolean } {
  const seen = new Map<string, Verdict>();
  const rank: Record<Verdict, number> = { allow: 0, ask: 1, deny: 2 };
  let hadConflict = false;
  const add = (patterns: string[] | undefined, verdict: Verdict) => {
    for (const raw of patterns ?? []) {
      const pattern = raw.trim();
      if (!pattern) continue;
      const existing = seen.get(pattern);
      if (existing === undefined) {
        seen.set(pattern, verdict);
      } else {
        hadConflict = true;
        if (rank[verdict] > rank[existing]) seen.set(pattern, verdict);
      }
    }
  };
  // Order doesn't matter — rank decides the winner — but list allow→deny
  // so first-seen order in the UI is stable.
  add(v.allow, "allow");
  add(v.ask, "ask");
  add(v.deny, "deny");
  return {
    rules: [...seen].map(([pattern, verdict]) => ({ pattern, verdict })),
    hadConflict,
  };
}

/** Split the unified list back into the stored {allow,ask,deny} shape. */
function toPermissions(rules: Rule[]): Required<PermissionsValue> {
  const out: Required<PermissionsValue> = { allow: [], ask: [], deny: [] };
  for (const r of rules) out[r.verdict].push(r.pattern);
  return out;
}

function rulesEqual(a: Rule[], b: Rule[]): boolean {
  if (a.length !== b.length) return false;
  const key = (r: Rule) => `${r.verdict} ${r.pattern}`;
  const sa = a.map(key).sort();
  const sb = b.map(key).sort();
  return sa.every((x, i) => x === sb[i]);
}

export function Permissions() {
  const [data, setData] = useState<Record<Scope, PermissionsValue> | null>(null);
  const [scope, setScope] = useState<Scope>("project");
  const [rules, setRules] = useState<Rule[]>([]);
  const [baseline, setBaseline] = useState<Rule[]>([]);
  const [hadConflict, setHadConflict] = useState(false);
  const [conflictDismissed, setConflictDismissed] = useState(false);
  const [mode, setMode] = useState<"guided" | "advanced">("guided");
  const [query, setQuery] = useState("");
  const [verdictFilter, setVerdictFilter] = useState<Verdict | "all">("all");
  const toast = useToast();

  function loadScope(d: Record<Scope, PermissionsValue>, s: Scope) {
    const { rules, hadConflict } = flatten(d[s] ?? {});
    setRules(rules);
    setBaseline(rules);
    setHadConflict(hadConflict);
    setConflictDismissed(false);
  }

  function refresh() {
    apiGet<Record<Scope, PermissionsValue>>("/permissions").then((d) => {
      setData(d);
      loadScope(d, scope);
    });
  }
  useEffect(refresh, []);
  useEffect(() => {
    if (data) loadScope(data, scope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const dirty = useMemo(() => !rulesEqual(rules, baseline), [rules, baseline]);

  // Display-only filtering for the guided list — Save always uses the full set.
  const isFiltering = query.trim() !== "" || verdictFilter !== "all";
  const visibleRules = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rules.filter(
      (r) =>
        (verdictFilter === "all" || r.verdict === verdictFilter) &&
        (!q || r.pattern.toLowerCase().includes(q)),
    );
  }, [rules, query, verdictFilter]);

  /** Add a rule, or flip the verdict of an existing identical pattern. */
  function upsert(pattern: string, verdict: Verdict) {
    const clean = pattern.trim();
    if (!clean) return;
    setRules((prev) => {
      const idx = prev.findIndex((r) => r.pattern === clean);
      if (idx === -1) return [...prev, { pattern: clean, verdict }];
      if (prev[idx].verdict === verdict) {
        toast.success(`${clean} is already set to ${verdict}.`);
        return prev;
      }
      const next = [...prev];
      next[idx] = { pattern: clean, verdict };
      toast.success(`Updated ${clean} → ${verdict}.`);
      return next;
    });
  }

  function setVerdict(pattern: string, verdict: Verdict) {
    setRules((prev) =>
      prev.map((r) => (r.pattern === pattern ? { ...r, verdict } : r)),
    );
  }

  function remove(pattern: string) {
    setRules((prev) => prev.filter((r) => r.pattern !== pattern));
  }

  async function save() {
    await apiPut(`/permissions/${scope}`, { permissions: toPermissions(rules) });
    setBaseline(rules);
    setHadConflict(false);
    // Keep local data cache in sync without a full reload flicker.
    setData((d) => (d ? { ...d, [scope]: toPermissions(rules) } : d));
  }

  if (!data) return <div className="text-muted">Loading…</div>;

  return (
    <div className="space-y-6 animate-page-in">
      <PageHeader
        chapter="IX"
        eyebrow="Chapter · Permissions"
        title="The rules of passage"
        subtitle={
          <>
            Choose what Claude may do — pick{" "}
            <span className="text-sage">Allow</span>,{" "}
            <span className="text-ember">Ask</span>, or{" "}
            <span className="text-brick">Deny</span> for each rule. No syntax to
            memorise.
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-rule bg-surface p-1">
          {SCOPES.map((s) => (
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

        <div className="inline-flex rounded-md border border-rule bg-surface p-1">
          {(["guided", "advanced"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`tab capitalize ${mode === m ? "tab-active" : ""}`}
              title={
                m === "advanced"
                  ? "Edit the raw allow / ask / deny lists"
                  : "Friendly rule builder"
              }
            >
              {m === "advanced" ? "Advanced (raw)" : "Guided"}
            </button>
          ))}
        </div>
      </div>

      {hadConflict && !conflictDismissed && (
        <div className="flex items-start justify-between gap-3 rounded-md border border-ember/40 bg-ember/10 p-3 text-[12px] text-ember">
          <span>
            Some rules were listed under more than one verdict. We kept the
            strictest (deny &gt; ask &gt; allow). Save to clean this up.
          </span>
          <button
            className="shrink-0 text-ember/80 hover:text-ember"
            onClick={() => setConflictDismissed(true)}
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {mode === "guided" ? (
        <>
          <RuleBuilder onAdd={upsert} />

          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow mr-1">Quick add</span>
            {PRESETS.map((p) => (
              <button
                key={p.pattern + p.verdict}
                className="btn-ghost text-[12px]"
                onClick={() => upsert(p.pattern, p.verdict)}
                title={`${p.pattern} → ${p.verdict}`}
              >
                + {p.label}
              </button>
            ))}
          </div>

          {rules.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <input
                className="field max-w-xs flex-1"
                placeholder="Search rules…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                spellCheck={false}
              />
              <div className="inline-flex rounded-md border border-rule bg-surface p-1">
                {(["all", "allow", "ask", "deny"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVerdictFilter(v)}
                    className={`tab capitalize ${verdictFilter === v ? "tab-active" : ""}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <span className="text-[12px] text-faint">
                {isFiltering
                  ? `${visibleRules.length} of ${rules.length}`
                  : `${rules.length} rule${rules.length === 1 ? "" : "s"}`}
              </span>
            </div>
          )}

          <RuleList
            rules={visibleRules}
            filtered={isFiltering}
            onSetVerdict={setVerdict}
            onRemove={remove}
          />
        </>
      ) : (
        <RawEditor rules={rules} onChange={setRules} />
      )}

      <div className="flex items-center gap-3">
        <ActionButton
          onAction={save}
          loadingText="Saving…"
          successText="Saved."
          disabled={!dirty}
        >
          Save
        </ActionButton>
        {dirty && (
          <span className="text-[12px] text-faint">Unsaved changes</span>
        )}
      </div>
    </div>
  );
}

function RuleBuilder({
  onAdd,
}: {
  onAdd: (pattern: string, verdict: Verdict) => void;
}) {
  const [tool, setTool] = useState(TOOLS[0].name);
  const [qualifier, setQualifier] = useState("");
  const [verdict, setVerdict] = useState<Verdict>("allow");

  const spec = TOOLS.find((t) => t.name === tool)!;
  const copy = QUALIFIER_COPY[spec.qualifier];

  const pattern = useMemo(
    () => composePattern(spec.qualifier, tool, qualifier),
    [spec.qualifier, tool, qualifier],
  );

  function add() {
    if (!pattern) return;
    onAdd(pattern, verdict);
    setQualifier("");
  }

  return (
    <div className="card space-y-4">
      <h3 className="font-display text-xl text-ink">Add a rule</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label">Tool</label>
          <select
            className="field"
            value={tool}
            onChange={(e) => {
              setTool(e.target.value);
              setQualifier("");
            }}
          >
            {TOOLS.map((t) => (
              <option key={t.name} value={t.name}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        {copy && (
          <div>
            <label className="label">{copy.label}</label>
            <input
              className="field-mono"
              placeholder={copy.placeholder}
              value={qualifier}
              spellCheck={false}
              onChange={(e) => setQualifier(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            {spec.qualifier === "mcp" && (
              <p className="mt-1 text-[11px] text-faint">
                e.g. <code className="font-mono">vercel</code> →{" "}
                <code className="font-mono">mcp__vercel</code>, or{" "}
                <code className="font-mono">vercel deploy</code> →{" "}
                <code className="font-mono">mcp__vercel__deploy</code>
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Rule</span>
          <div className="mt-1 font-mono text-[13px] text-ink">
            {pattern ? (
              pattern
            ) : (
              <span className="text-faint">pick a tool…</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <VerdictToggle value={verdict} onChange={setVerdict} />
          <button
            className="btn-primary"
            onClick={add}
            disabled={!pattern}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function composePattern(
  qualifier: Qualifier,
  tool: string,
  raw: string,
): string {
  const q = raw.trim();
  if (qualifier === "custom") return q;
  if (qualifier === "none") return tool;
  if (qualifier === "mcp") {
    if (!q) return "mcp__";
    const [server, ...rest] = q.split(/\s+/);
    const sub = rest.join("_");
    return sub ? `mcp__${server}__${sub}` : `mcp__${server}`;
  }
  // command / path / domain
  return q ? `${tool}(${q})` : tool;
}

function RuleList({
  rules,
  filtered,
  onSetVerdict,
  onRemove,
}: {
  rules: Rule[];
  filtered: boolean;
  onSetVerdict: (pattern: string, v: Verdict) => void;
  onRemove: (pattern: string) => void;
}) {
  if (rules.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-rule bg-sunken p-6 text-center">
        <div className="font-display italic text-muted">
          {filtered
            ? "No rules match this filter."
            : "No rules in this scope yet. Add one above to get started."}
        </div>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {rules.map((r, i) => (
        <li
          key={r.pattern}
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-rule bg-surface px-4 py-3 animate-fade-in"
          style={{ animationDelay: `${i * 20}ms` }}
        >
          <span className="min-w-0 break-all font-mono text-[13px] text-ink">
            {r.pattern}
          </span>
          <div className="flex items-center gap-2">
            <VerdictToggle
              value={r.verdict}
              onChange={(v) => onSetVerdict(r.pattern, v)}
            />
            <button
              className="btn-quiet px-2 text-[13px]"
              onClick={() => onRemove(r.pattern)}
              title="Remove this rule"
              aria-label={`Remove ${r.pattern}`}
            >
              🗑
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function VerdictToggle({
  value,
  onChange,
}: {
  value: Verdict;
  onChange: (v: Verdict) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {VERDICTS.map((opt) => {
        const active = opt.v === value;
        return (
          <button
            key={opt.v}
            onClick={() => onChange(opt.v)}
            className={
              active ? `pill-${opt.tone} text-[11px]` : "btn-ghost text-[11px]"
            }
            title={opt.hint}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Raw escape hatch — three textareas backed by the same Rule[] state.
 *  Parses on every edit so toggling back to Guided reflects changes. */
function RawEditor({
  rules,
  onChange,
}: {
  rules: Rule[];
  onChange: (rules: Rule[]) => void;
}) {
  const text = useMemo(() => {
    const p = toPermissions(rules);
    return {
      allow: p.allow.join("\n"),
      ask: p.ask.join("\n"),
      deny: p.deny.join("\n"),
    };
  }, [rules]);

  function update(verdict: Verdict, raw: string) {
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    // Rebuild the full {allow,ask,deny} block, replacing the edited list,
    // then re-flatten so cross-list duplicates collapse by precedence.
    const current = toPermissions(rules);
    current[verdict] = lines;
    onChange(flatten(current).rules);
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {VERDICTS.map((opt) => (
        <div key={opt.v} className={`card ${opt.border}`}>
          <h3 className={`mb-2 font-display text-xl ${opt.text}`}>
            {opt.label}
          </h3>
          <textarea
            className="field-mono h-72 text-[12px]"
            value={text[opt.v]}
            onChange={(e) => update(opt.v, e.target.value)}
            spellCheck={false}
            placeholder="One rule per line"
          />
          <div className="mt-2 text-[11px] text-faint">{opt.hint}. One per line.</div>
        </div>
      ))}
    </div>
  );
}
