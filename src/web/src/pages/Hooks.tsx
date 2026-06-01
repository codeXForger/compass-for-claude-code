import { useEffect, useState } from "react";
import { apiGet, apiPut } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { ActionButton, SkipError } from "../components/ActionButton";

type Scope = "project" | "user" | "local";
type Mode = "form" | "json";

interface HookCommand {
  type: "command";
  command: string;
}
interface MatcherGroup {
  matcher: string;
  hooks: HookCommand[];
}
type HooksConfig = Record<string, MatcherGroup[]>;

/** The nine Claude Code hook events, with plain-language labels. */
const EVENTS: {
  event: string;
  label: string;
  description: string;
  usesMatcher: boolean;
}[] = [
  {
    event: "PreToolUse",
    label: "Before a tool runs",
    description: "Fires before Claude runs a tool — block or approve it first.",
    usesMatcher: true,
  },
  {
    event: "PostToolUse",
    label: "After a tool runs",
    description: "Fires after a tool finishes — auto-format, lint, test, or log.",
    usesMatcher: true,
  },
  {
    event: "UserPromptSubmit",
    label: "When you submit a prompt",
    description: "Fires before Claude sees your prompt — inject context or block it.",
    usesMatcher: false,
  },
  {
    event: "Notification",
    label: "On a notification",
    description: "Fires when Claude Code needs permission or goes idle — ping yourself.",
    usesMatcher: false,
  },
  {
    event: "Stop",
    label: "When Claude finishes its turn",
    description: "Fires when the main agent stops — notify, auto-commit, or clean up.",
    usesMatcher: false,
  },
  {
    event: "SubagentStop",
    label: "When a subagent finishes",
    description: "Fires when a spawned subagent (Task) finishes.",
    usesMatcher: false,
  },
  {
    event: "PreCompact",
    label: "Before context is compacted",
    description: "Fires before the conversation is summarized — persist state.",
    usesMatcher: false,
  },
  {
    event: "SessionStart",
    label: "When a session starts",
    description: "Fires when a session starts or resumes — seed context, warm caches.",
    usesMatcher: false,
  },
  {
    event: "SessionEnd",
    label: "When a session ends",
    description: "Fires when a session ends — teardown, flush logs, final notice.",
    usesMatcher: false,
  },
];

/** Tools commonly matched by PreToolUse / PostToolUse hooks. */
const COMMON_TOOLS = [
  "Bash",
  "Edit",
  "Write",
  "Read",
  "Glob",
  "Grep",
  "WebFetch",
  "WebSearch",
  "Task",
];

const eventMeta = (event: string) => EVENTS.find((e) => e.event === event);

/** Loosely validate raw settings.hooks into our typed shape. */
function toConfig(raw: unknown): HooksConfig {
  if (!raw || typeof raw !== "object") return {};
  const out: HooksConfig = {};
  for (const [event, groups] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(groups)) continue;
    out[event] = groups.map((g) => {
      const group = (g ?? {}) as Record<string, unknown>;
      const hooks = Array.isArray(group.hooks) ? group.hooks : [];
      return {
        matcher: typeof group.matcher === "string" ? group.matcher : "",
        hooks: hooks
          .filter(
            (h): h is { command: string } =>
              !!h && typeof (h as Record<string, unknown>).command === "string",
          )
          .map((h) => ({ type: "command" as const, command: h.command })),
      };
    });
  }
  return out;
}

/** Drop empty hook arrays / groups / events so saved JSON stays clean. */
function prune(config: HooksConfig): HooksConfig {
  const out: HooksConfig = {};
  for (const [event, groups] of Object.entries(config)) {
    const kept = groups.filter((g) => g.hooks.length > 0);
    if (kept.length) out[event] = kept;
  }
  return out;
}

export function Hooks() {
  const [data, setData] = useState<{
    project: unknown;
    user: unknown;
    local: unknown;
  } | null>(null);
  const [scope, setScope] = useState<Scope>("project");
  const [mode, setMode] = useState<Mode>("form");
  const [config, setConfig] = useState<HooksConfig>({});
  const [draft, setDraft] = useState("");

  // Add-hook form state
  const [adding, setAdding] = useState(false);
  const [newEvent, setNewEvent] = useState(EVENTS[0].event);
  const [newTools, setNewTools] = useState<string[]>([]);
  const [newCustomMatcher, setNewCustomMatcher] = useState("");
  const [newCommand, setNewCommand] = useState("");

  // Inline edit state — keyed as `${event}|${groupIdx}|${hookIdx}`
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  function refresh() {
    return apiGet<{ project: unknown; user: unknown; local: unknown }>(
      "/hooks",
    ).then(setData);
  }
  useEffect(() => {
    refresh();
  }, []);

  // Re-derive form config + JSON draft whenever the loaded data or scope changes.
  useEffect(() => {
    if (!data) return;
    const raw = data[scope];
    setConfig(toConfig(raw));
    setDraft(JSON.stringify(raw ?? {}, null, 2));
    setAdding(false);
    setEditKey(null);
  }, [data, scope]);

  /** Persist a config object (form mode) and reload from the server. */
  async function persist(next: HooksConfig) {
    await apiPut(`/hooks/${scope}`, { hooks: prune(next) });
    await refresh();
  }

  async function addHook() {
    const meta = eventMeta(newEvent);
    if (!newCommand.trim()) throw new SkipError();
    const matcher = meta?.usesMatcher
      ? [...newTools, newCustomMatcher.trim()].filter(Boolean).join("|")
      : "";
    const next: HooksConfig = JSON.parse(JSON.stringify(config));
    const groups = next[newEvent] ?? (next[newEvent] = []);
    let group = groups.find((g) => g.matcher === matcher);
    if (!group) {
      group = { matcher, hooks: [] };
      groups.push(group);
    }
    group.hooks.push({ type: "command", command: newCommand.trim() });
    await persist(next);
    setAdding(false);
    setNewTools([]);
    setNewCustomMatcher("");
    setNewCommand("");
  }

  async function removeHook(event: string, gi: number, hi: number) {
    if (!confirm("Remove this hook?")) throw new SkipError();
    const next: HooksConfig = JSON.parse(JSON.stringify(config));
    next[event][gi].hooks.splice(hi, 1);
    await persist(next);
  }

  async function saveEdit(event: string, gi: number, hi: number) {
    if (!editText.trim()) throw new SkipError();
    const next: HooksConfig = JSON.parse(JSON.stringify(config));
    next[event][gi].hooks[hi].command = editText.trim();
    await persist(next);
    setEditKey(null);
  }

  /** JSON (advanced) mode: parse the textarea and save the whole block. */
  async function saveJson() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch (e) {
      throw new Error(`Invalid JSON: ${(e as Error).message}`);
    }
    await apiPut(`/hooks/${scope}`, { hooks: parsed });
    await refresh();
  }

  function toggleTool(t: string) {
    setNewTools((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  if (!data) return <div className="text-muted">Loading…</div>;

  const newMeta = eventMeta(newEvent);
  const previewMatcher = [...newTools, newCustomMatcher.trim()]
    .filter(Boolean)
    .join("|");
  const presentEvents = EVENTS.filter(
    (e) => (config[e.event] ?? []).some((g) => g.hooks.length > 0),
  );
  const isEmpty = presentEvents.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        chapter="V"
        eyebrow="Chapter · Hooks"
        title="Triggers along the route"
        subtitle={
          <>
            run a command when something happens — saved to the{" "}
            <code className="font-mono not-italic text-ink">hooks</code> block of
            settings.json
          </>
        }
        meta="backups are written before saving"
      />

      <div className="flex flex-wrap items-center gap-3">
        {/* Scope tabs */}
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

        {/* Form / JSON toggle */}
        <div className="inline-flex rounded-md border border-rule bg-surface p-1">
          <button
            onClick={() => setMode("form")}
            className={`tab ${mode === "form" ? "tab-active" : ""}`}
          >
            Form
          </button>
          <button
            onClick={() => {
              setDraft(JSON.stringify(prune(config), null, 2));
              setMode("json");
            }}
            className={`tab ${mode === "json" ? "tab-active" : ""}`}
          >
            JSON · advanced
          </button>
        </div>
      </div>

      {mode === "form" ? (
        <div className="space-y-6">
          {/* Add hook */}
          {!adding ? (
            <button className="btn-primary" onClick={() => setAdding(true)}>
              + Add hook
            </button>
          ) : (
            <div className="card space-y-4 animate-page-in">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl text-ink">New hook</h2>
                <button className="btn-quiet" onClick={() => setAdding(false)}>
                  Cancel
                </button>
              </div>

              <div>
                <label className="label">When should it run?</label>
                <select
                  className="field"
                  value={newEvent}
                  onChange={(e) => setNewEvent(e.target.value)}
                >
                  {EVENTS.map((e) => (
                    <option key={e.event} value={e.event}>
                      {e.label} ({e.event})
                    </option>
                  ))}
                </select>
                {newMeta && (
                  <p className="mt-1 text-[11.5px] text-muted">
                    {newMeta.description}
                  </p>
                )}
              </div>

              {newMeta?.usesMatcher && (
                <div>
                  <label className="label">Run on which tools?</label>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {COMMON_TOOLS.map((t) => (
                      <label
                        key={t}
                        className="flex cursor-pointer items-center gap-2 text-sm text-ink"
                      >
                        <input
                          type="checkbox"
                          className="accent-brass"
                          checked={newTools.includes(t)}
                          onChange={() => toggleTool(t)}
                        />
                        <span className="font-mono text-[12px]">{t}</span>
                      </label>
                    ))}
                  </div>
                  <input
                    className="field-mono mt-3"
                    placeholder="custom pattern · e.g. mcp__.*"
                    value={newCustomMatcher}
                    onChange={(e) => setNewCustomMatcher(e.target.value)}
                  />
                  <p className="mt-1 text-[11.5px] text-muted">
                    matcher:{" "}
                    <code className="font-mono text-ink">
                      {previewMatcher || "(all tools)"}
                    </code>
                    {" · "}leave everything blank to match every tool
                  </p>
                </div>
              )}

              <div>
                <label className="label">Command to run</label>
                <input
                  className="field-mono"
                  placeholder="./scripts/guard.sh"
                  value={newCommand}
                  onChange={(e) => setNewCommand(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <ActionButton
                  onAction={addHook}
                  disabled={!newCommand.trim()}
                  loadingText="Adding…"
                  successText="Hook added."
                >
                  Add hook
                </ActionButton>
                <button className="btn-ghost" onClick={() => setAdding(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Configured hooks, grouped by event */}
          {isEmpty ? (
            <div className="rounded-md border border-dashed border-rule bg-sunken p-6 text-center">
              <div className="font-display text-2xl italic text-muted">
                No hooks configured.
              </div>
              <div className="mt-1 text-[12px] text-faint">
                Add one above to run a command when something happens.
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {presentEvents.map((meta) => (
                <div key={meta.event} className="card space-y-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-xl text-ink">
                        {meta.label}
                      </span>
                      <span className="pill-quiet font-mono text-[10px]">
                        {meta.event}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-faint">
                      {meta.description}
                    </div>
                  </div>

                  <ul className="space-y-2">
                    {config[meta.event].map((group, gi) =>
                      group.hooks.map((hook, hi) => {
                        const key = `${meta.event}|${gi}|${hi}`;
                        const editing = editKey === key;
                        return (
                          <li
                            key={key}
                            className="rounded-md border border-rule bg-surface px-4 py-3 transition-colors hover:border-brass/40"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] text-faint">
                                  on{" "}
                                  <span className="font-mono text-muted">
                                    {group.matcher || "all tools"}
                                  </span>
                                </div>
                                {editing ? (
                                  <input
                                    className="field-mono mt-1"
                                    value={editText}
                                    autoFocus
                                    onChange={(e) => setEditText(e.target.value)}
                                  />
                                ) : (
                                  <div className="truncate font-mono text-sm text-ink">
                                    {hook.command}
                                  </div>
                                )}
                              </div>
                              <div className="flex shrink-0 gap-2">
                                {editing ? (
                                  <>
                                    <ActionButton
                                      onAction={() => saveEdit(meta.event, gi, hi)}
                                      loadingText="Saving…"
                                      successText="Saved."
                                    >
                                      Save
                                    </ActionButton>
                                    <button
                                      className="btn-ghost"
                                      onClick={() => setEditKey(null)}
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      className="btn-quiet"
                                      onClick={() => {
                                        setEditKey(key);
                                        setEditText(hook.command);
                                      }}
                                    >
                                      Edit
                                    </button>
                                    <ActionButton
                                      variant="danger"
                                      onAction={() =>
                                        removeHook(meta.event, gi, hi)
                                      }
                                      loadingText="Removing…"
                                      successText="Removed."
                                    >
                                      Remove
                                    </ActionButton>
                                  </>
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      }),
                    )}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <textarea
            className="field-mono h-[60vh] leading-relaxed"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
          />
          <div className="flex items-center gap-3">
            <ActionButton
              onAction={saveJson}
              loadingText="Saving…"
              successText="Saved."
            >
              Save
            </ActionButton>
          </div>
        </div>
      )}
    </div>
  );
}
