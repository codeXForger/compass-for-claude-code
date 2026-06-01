import { useEffect, useState } from "react";
import { apiGet, apiPut } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { ActionButton } from "../components/ActionButton";

type Scope = "project" | "user" | "local";

interface PermissionsValue {
  allow?: string[];
  deny?: string[];
  ask?: string[];
}

export function Permissions() {
  const [data, setData] = useState<{
    project: PermissionsValue;
    user: PermissionsValue;
    local: PermissionsValue;
  } | null>(null);
  const [scope, setScope] = useState<Scope>("project");
  const [allow, setAllow] = useState("");
  const [deny, setDeny] = useState("");
  const [ask, setAsk] = useState("");

  function refresh() {
    apiGet<{
      project: PermissionsValue;
      user: PermissionsValue;
      local: PermissionsValue;
    }>("/permissions").then((d) => {
      setData(d);
      const v = d[scope] ?? {};
      setAllow((v.allow ?? []).join("\n"));
      setDeny((v.deny ?? []).join("\n"));
      setAsk((v.ask ?? []).join("\n"));
    });
  }
  useEffect(refresh, []);
  useEffect(() => {
    if (data) {
      const v = data[scope] ?? {};
      setAllow((v.allow ?? []).join("\n"));
      setDeny((v.deny ?? []).join("\n"));
      setAsk((v.ask ?? []).join("\n"));
    }
  }, [scope, data]);

  async function save() {
    const toArr = (s: string) =>
      s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    await apiPut(`/permissions/${scope}`, {
      permissions: {
        allow: toArr(allow),
        deny: toArr(deny),
        ask: toArr(ask),
      },
    });
    refresh();
  }

  if (!data) return <div className="text-muted">Loading…</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        chapter="IX"
        eyebrow="Chapter · Permissions"
        title="The rules of passage"
        subtitle={
          <>
            allow / ask / deny patterns — e.g.{" "}
            <code className="font-mono not-italic text-ink">Bash(git *)</code>
          </>
        }
      />

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <PermList
          label="Allow"
          tone="sage"
          glyph="✓"
          value={allow}
          onChange={setAllow}
          hint="Run without prompting. One per line."
        />
        <PermList
          label="Ask"
          tone="ember"
          glyph="?"
          value={ask}
          onChange={setAsk}
          hint="Prompt before running."
        />
        <PermList
          label="Deny"
          tone="brick"
          glyph="✗"
          value={deny}
          onChange={setDeny}
          hint="Block outright."
        />
      </div>

      <div className="flex items-center gap-3">
        <ActionButton onAction={save} loadingText="Saving…" successText="Saved.">
          Save
        </ActionButton>
      </div>
    </div>
  );
}

function PermList({
  label,
  tone,
  glyph,
  value,
  onChange,
  hint,
}: {
  label: string;
  tone: "sage" | "ember" | "brick";
  glyph: string;
  value: string;
  onChange: (v: string) => void;
  hint: string;
}) {
  const toneText = {
    sage: "text-sage",
    ember: "text-ember",
    brick: "text-brick",
  }[tone];
  const toneBorder = {
    sage: "border-sage/30",
    ember: "border-ember/30",
    brick: "border-brick/30",
  }[tone];
  return (
    <div className={`card ${toneBorder}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className={`font-display text-2xl leading-none ${toneText}`}>
          {glyph}
        </span>
        <h3 className="font-display text-xl text-ink">{label}</h3>
      </div>
      <textarea
        className="field-mono h-72 text-[12px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
      <div className="mt-2 text-[11px] text-faint">{hint}</div>
    </div>
  );
}
