import { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPut } from "../lib/api";
import { ActionButton, SkipError } from "./ActionButton";

interface SkillFile {
  path: string;
  size: number;
  executable: boolean;
}

const enc = (scope: string, name: string, rel: string) =>
  `/skills/${scope}/${encodeURIComponent(name)}/files/${rel
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

export function SkillFiles({
  scope,
  name,
}: {
  scope: "project" | "user";
  name: string;
}) {
  const [files, setFiles] = useState<SkillFile[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editingPath, setEditingPath] = useState<string | null>(null); // null = new file
  const [path, setPath] = useState("");
  const [content, setContent] = useState("");
  const [executable, setExecutable] = useState(false);

  function load() {
    apiGet<{ files: SkillFile[] }>(
      `/skills/${scope}/${encodeURIComponent(name)}/files`,
    ).then((r) => setFiles(r.files));
  }
  useEffect(load, [scope, name]);

  function close() {
    setOpen(false);
    setEditingPath(null);
    setPath("");
    setContent("");
    setExecutable(false);
  }

  function openAdd(asScript: boolean) {
    setEditingPath(null);
    setPath(asScript ? "scripts/" : "");
    setContent(asScript ? "#!/usr/bin/env bash\n" : "");
    setExecutable(asScript);
    setOpen(true);
  }

  async function openEdit(f: SkillFile) {
    const r = await apiGet<{ content: string; executable: boolean }>(
      enc(scope, name, f.path),
    );
    setEditingPath(f.path);
    setPath(f.path);
    setContent(r.content);
    setExecutable(r.executable);
    setOpen(true);
  }

  async function saveFile() {
    const rel = path.trim();
    if (!rel || rel.endsWith("/")) throw new SkipError();
    await apiPut(enc(scope, name, rel), { content, executable });
    close();
    load();
  }

  async function removeFile(f: SkillFile) {
    if (!confirm(`Remove "${f.path}"?`)) throw new SkipError();
    await apiDelete(enc(scope, name, f.path));
    load();
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-xl text-ink">Resources &amp; scripts</h3>
          <p className="mt-0.5 text-[11.5px] text-faint">
            Files bundled with this skill. <code className="font-mono">SKILL.md</code>{" "}
            is edited above.
          </p>
        </div>
        {!open && (
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => openAdd(false)}>
              + Add file
            </button>
            <button className="btn-primary" onClick={() => openAdd(true)}>
              + Add script
            </button>
          </div>
        )}
      </div>

      {open && (
        <div className="card-flat space-y-3 p-4 animate-page-in">
          <div>
            <label className="label">Path · relative to the skill folder</label>
            <input
              className="field-mono"
              value={path}
              placeholder="scripts/build.sh"
              readOnly={editingPath !== null}
              onChange={(e) => setPath(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Contents</label>
            <textarea
              className="field-mono h-64 leading-relaxed"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="accent-brass"
              checked={executable}
              onChange={(e) => setExecutable(e.target.checked)}
            />
            Make executable (runnable script — chmod +x)
          </label>
          <div className="flex gap-2">
            <ActionButton
              onAction={saveFile}
              loadingText="Saving…"
              successText="Saved."
            >
              Save file
            </ActionButton>
            <button className="btn-ghost" onClick={close}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {files === null ? (
        <div className="text-sm text-muted">Loading…</div>
      ) : files.length === 0 ? (
        <div className="rounded-md border border-dashed border-rule bg-sunken p-6 text-center">
          <div className="font-display text-xl italic text-muted">
            No resource files yet.
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.path}
              className="flex items-center justify-between gap-3 rounded-md border border-rule bg-surface px-4 py-2.5 transition-colors hover:border-brass/40"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-mono text-sm text-ink">
                  {f.path}
                </span>
                {f.executable && (
                  <span className="pill-sage text-[10px]">runnable</span>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <button className="btn-quiet" onClick={() => openEdit(f)}>
                  Edit
                </button>
                <ActionButton
                  variant="danger"
                  onAction={() => removeFile(f)}
                  loadingText="Removing…"
                  successText="Removed."
                >
                  Remove
                </ActionButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
