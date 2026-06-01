import { useEffect, useState } from "react";
import { apiGet, apiPut } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { ActionButton } from "../components/ActionButton";

interface ClaudeMdResponse {
  path: string;
  exists: boolean;
  content: string | null;
}

type Variant = "project" | "local";

export function ClaudeMd() {
  const [data, setData] = useState<ClaudeMdResponse | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirmGen, setConfirmGen] = useState(false);
  const [genOutput, setGenOutput] = useState("");
  const [variant, setVariant] = useState<Variant>("project");

  const endpoint = variant === "local" ? "/claudemd/local" : "/claudemd";

  function refresh() {
    apiGet<ClaudeMdResponse>(endpoint).then((d) => {
      setData(d);
      setDraft(d.content ?? "");
      setEditing(false);
    });
  }
  // Reload whenever the active file (project vs local) changes.
  useEffect(() => {
    setData(null);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  async function save() {
    await apiPut(endpoint, { content: draft });
    setEditing(false);
    refresh();
  }

  async function generate() {
    setGenerating(true);
    setConfirmGen(false);
    setGenOutput("");
    try {
      const resp = await fetch("/api/claudemd/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!resp.ok || !resp.body) {
        setGenOutput(`Error: ${resp.status}`);
        setGenerating(false);
        return;
      }
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const ev = /^event: (.+)$/m.exec(part);
          const da = /^data: (.+)$/m.exec(part);
          if (!ev || !da) continue;
          if (ev[1] === "chunk") setGenOutput((s) => s + da[1]);
          if (ev[1] === "done") {
            refresh();
            setGenerating(false);
          }
          if (ev[1] === "error") {
            setGenOutput((s) => s + `\n[error] ${da[1]}\n`);
            setGenerating(false);
          }
        }
      }
    } catch (e) {
      setGenOutput(String(e));
      setGenerating(false);
    }
  }

  if (!data) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-md border border-rule bg-surface p-1">
        {(["project", "local"] as Variant[]).map((v) => (
          <button
            key={v}
            onClick={() => setVariant(v)}
            className={`tab ${variant === v ? "tab-active" : ""}`}
            title={
              v === "local" ? "CLAUDE.local.md — personal, gitignored" : undefined
            }
          >
            {v === "local" ? "CLAUDE.local.md" : "CLAUDE.md"}
          </button>
        ))}
      </div>

      <PageHeader
        chapter="II"
        eyebrow="Chapter · CLAUDE.md"
        title="The project's compass-note"
        subtitle={
          variant === "local"
            ? "personal project instructions — gitignored, never shared"
            : "instructions Claude reads on every run"
        }
        meta={data.path}
        actions={
          data.exists && !editing && !generating ? (
            <div className="flex gap-2">
              {variant === "project" && (
                <button
                  className="btn-ghost"
                  onClick={() => setConfirmGen((v) => !v)}
                >
                  Regenerate
                </button>
              )}
              <button className="btn-ghost" onClick={() => setEditing(true)}>
                Edit
              </button>
            </div>
          ) : editing ? (
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <ActionButton
                onAction={save}
                loadingText="Saving…"
                successText="Saved."
              >
                Save
              </ActionButton>
            </div>
          ) : null
        }
      />

      {!data.exists && !generating && !confirmGen && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <span className="dot bg-ember" />
            <h2 className="font-display text-2xl text-ink">
              {variant === "local" ? "No CLAUDE.local.md yet" : "No CLAUDE.md yet"}
            </h2>
          </div>
          <p className="text-sm text-muted">
            {variant === "local" ? (
              <>
                Personal, project-specific instructions that load alongside
                CLAUDE.md but stay out of git. Start with an empty file.
              </>
            ) : (
              <>
                Generate one by running the{" "}
                <code className="font-mono text-ink">/init</code> command of the
                local <code className="font-mono text-ink">claude</code> CLI, or
                start with an empty file.
              </>
            )}
          </p>
          <div className="flex gap-2">
            {variant === "project" && (
              <button
                className="btn-primary"
                onClick={() => setConfirmGen(true)}
              >
                Generate
              </button>
            )}
            <button
              className={variant === "local" ? "btn-primary" : "btn-ghost"}
              onClick={() => {
                setEditing(true);
                setData({ ...data, exists: true });
                setDraft(
                  variant === "local" ? "# CLAUDE.local.md\n\n" : "# CLAUDE.md\n\n",
                );
              }}
            >
              Start blank
            </button>
          </div>
        </div>
      )}

      {confirmGen && !generating && !editing && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <span className="dot bg-ember" />
            <h2 className="font-display text-2xl text-ink">
              Run <code className="font-mono">/init</code>?
            </h2>
          </div>
          <p className="text-sm text-muted">
            This runs Claude's{" "}
            <code className="font-mono text-ink">/init</code> command in this
            project. It will{" "}
            {data.exists ? (
              <>
                <strong className="text-ink">overwrite</strong> the existing
                CLAUDE.md
              </>
            ) : (
              <>create CLAUDE.md</>
            )}{" "}
            at <code className="font-mono text-ink">{data.path}</code>.
          </p>
          <div className="code-block text-xs">
            $ claude --print /init
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={generate}>
              {data.exists ? "Regenerate" : "Generate"}
            </button>
            <button
              className="btn-ghost"
              onClick={() => setConfirmGen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {generating && (
        <div className="card">
          <div className="mb-2 flex items-center gap-2 eyebrow">
            <span className="dot bg-brass animate-pulse" />
            Running <code className="font-mono">/init</code>…
          </div>
          <pre className="code-block max-h-[60vh] overflow-auto whitespace-pre-wrap">
            {genOutput || "Waiting for Claude…"}
          </pre>
        </div>
      )}

      {data.exists && !generating && (
        editing ? (
          <textarea
            className="field-mono h-[60vh] leading-relaxed"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
          />
        ) : (
          <div className="card">
            <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-ink">
              {data.content}
            </pre>
          </div>
        )
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-20 animate-pulse rounded bg-rule" />
      <div className="h-[60vh] animate-pulse rounded bg-rule" />
    </div>
  );
}
