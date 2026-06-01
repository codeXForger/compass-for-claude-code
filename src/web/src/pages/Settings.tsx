import { useEffect, useState } from "react";
import { apiGet, apiPut } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { ActionButton } from "../components/ActionButton";

type Variant = "settings" | "settingsLocal";
type Scope = "project" | "user";
type Key = `${Scope}.${Variant}`;
type SettingsResponse = Record<Key, { path: string; content: string | null }>;

const TABS: { key: Key; label: string; sub: string }[] = [
  { key: "project.settings", label: "Project", sub: "settings.json" },
  { key: "project.settingsLocal", label: "Project · local", sub: "settings.local.json" },
  { key: "user.settings", label: "User", sub: "settings.json" },
  { key: "user.settingsLocal", label: "User · local", sub: "settings.local.json" },
];

export function Settings() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [active, setActive] = useState<Key>("project.settings");
  const [draft, setDraft] = useState<string>("");

  function refresh() {
    apiGet<SettingsResponse>("/settings").then((d) => {
      setData(d);
      setDraft(d[active]?.content ?? "");
    });
  }
  useEffect(refresh, []);
  useEffect(() => {
    if (data) setDraft(data[active]?.content ?? "");
  }, [active, data]);

  async function save(): Promise<string> {
    try {
      JSON.parse(draft);
    } catch (e) {
      throw new Error(`Invalid JSON: ${(e as Error).message}`);
    }
    const [scope, variant] = active.split(".") as [Scope, Variant];
    const r = await apiPut<{ ok: boolean; backedUpTo: string | null }>(
      `/settings/${scope}/${variant}`,
      { content: draft },
    );
    refresh();
    return r.backedUpTo ? `Saved (backup: ${r.backedUpTo})` : "Saved.";
  }

  if (!data) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader
        chapter="III"
        eyebrow="Chapter · Settings"
        title="The chart corrections"
        subtitle={<>edit settings.json at project &amp; user scope</>}
        meta="backups are written before each save"
      />

      <div className="flex flex-wrap gap-1 rounded-md border border-rule bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`tab flex-1 justify-start ${
              active === t.key ? "tab-active" : ""
            }`}
          >
            <span>{t.label}</span>
            <span className="font-mono text-[10px] text-faint">{t.sub}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[11px] text-faint">
          {data[active]?.path}
        </div>
        {data[active]?.content === null && (
          <span className="pill-ember">
            <span className="dot bg-ember" /> file does not exist · save to create
          </span>
        )}
      </div>

      <textarea
        className="field-mono h-[60vh] text-[13px] leading-relaxed"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={
          data[active]?.content === null
            ? "(file does not exist — save to create)"
            : ""
        }
        spellCheck={false}
      />

      <div className="flex items-center gap-3">
        <ActionButton
          onAction={save}
          loadingText="Saving…"
          successText="Saved."
        >
          Save changes
        </ActionButton>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-24 animate-pulse rounded bg-rule" />
      <div className="h-12 animate-pulse rounded bg-rule" />
      <div className="h-[60vh] animate-pulse rounded bg-rule" />
    </div>
  );
}
