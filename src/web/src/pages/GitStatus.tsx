import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";
import { PageHeader } from "../components/PageHeader";

type ChangeType =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "untracked"
  | "conflicted"
  | "typechange";

interface GitFile {
  path: string;
  orig: string | null;
  index: string;
  worktree: string;
  staged: boolean;
  unstaged: boolean;
  type: ChangeType;
  added: number | null;
  removed: number | null;
}
interface StatusResponse {
  isRepo: boolean;
  branch: string | null;
  files: GitFile[];
}
interface DiffResponse {
  path: string;
  diff?: string;
  body?: string;
  untracked?: boolean;
  tooLargeOrBinary?: boolean;
}

const BADGE: Record<ChangeType, { label: string; cls: string }> = {
  added: { label: "A", cls: "pill-sage" },
  untracked: { label: "?", cls: "pill-sage" },
  modified: { label: "M", cls: "pill-ember" },
  typechange: { label: "T", cls: "pill-ember" },
  deleted: { label: "D", cls: "pill-brick" },
  conflicted: { label: "!", cls: "pill-brick" },
  renamed: { label: "R", cls: "pill-brass" },
  copied: { label: "C", cls: "pill-brass" },
};

export function GitStatus() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [selected, setSelected] = useState<GitFile | null>(null);
  const [diff, setDiff] = useState<DiffResponse | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  function refresh() {
    apiGet<StatusResponse>("/git/status").then(setData);
  }
  useEffect(refresh, []);

  useEffect(() => {
    if (!selected) return;
    setDiff(null);
    setLoadingDiff(true);
    const u = selected.type === "untracked" ? "&untracked=1" : "";
    apiGet<DiffResponse>(
      `/git/diff?path=${encodeURIComponent(selected.path)}${u}`,
    )
      .then(setDiff)
      .finally(() => setLoadingDiff(false));
  }, [selected]);

  if (!data) return <div className="text-muted">Loading…</div>;

  const staged = data.files.filter((f) => f.staged);
  const unstaged = data.files.filter((f) => f.unstaged || f.type === "untracked");

  return (
    <div className="space-y-6">
      <PageHeader
        chapter="XIV"
        eyebrow="Chapter · Git"
        title="What has changed"
        subtitle={
          data.isRepo ? (
            <>
              working tree against{" "}
              <code className="font-mono not-italic text-ink">
                {data.branch ?? "HEAD"}
              </code>
            </>
          ) : (
            "no repository here"
          )
        }
        actions={
          <button className="btn-ghost" onClick={refresh}>
            Refresh
          </button>
        }
      />

      {!data.isRepo ? (
        <EmptyState message="This project is not a git repository." />
      ) : data.files.length === 0 ? (
        <EmptyState message="Working tree clean — nothing to commit." />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:h-[calc(100vh-16rem)] md:grid-cols-3 md:grid-rows-[minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col gap-6">
            <FileGroup
              title="Staged"
              files={staged}
              selected={selected}
              onPick={setSelected}
            />
            <FileGroup
              title="Unstaged & untracked"
              files={unstaged}
              selected={selected}
              onPick={setSelected}
              grow
            />
          </aside>

          <section className="flex min-h-0 flex-col md:col-span-2">
            {!selected ? (
              <EmptyState message="Select a file to view its diff." />
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="card-flat shrink-0 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={BADGE[selected.type].cls}>
                      {BADGE[selected.type].label}
                    </span>
                    <span className="truncate font-mono text-sm text-ink">
                      {selected.path}
                    </span>
                    <LineCount added={selected.added} removed={selected.removed} />
                  </div>
                  {selected.orig && (
                    <div className="mt-1 font-mono text-[11px] text-faint">
                      renamed from {selected.orig}
                    </div>
                  )}
                </div>
                <div className="min-h-0 flex-1">
                  {loadingDiff ? (
                    <div className="text-muted">Loading diff…</div>
                  ) : (
                    <DiffView diff={diff} />
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function FileGroup({
  title,
  files,
  selected,
  onPick,
  grow,
}: {
  title: string;
  files: GitFile[];
  selected: GitFile | null;
  onPick: (f: GitFile) => void;
  /** When true, the list fills remaining column height; otherwise it caps and scrolls. */
  grow?: boolean;
}) {
  return (
    <div className={`flex min-h-0 flex-col ${grow ? "flex-1" : "shrink-0"}`}>
      <div className="mb-2 flex shrink-0 items-center justify-between eyebrow">
        <span>{title}</span>
        <span className="font-mono normal-case tracking-normal text-faint">
          {files.length}
        </span>
      </div>
      <ul
        className={`space-y-1 overflow-auto rounded-md border border-rule bg-surface p-1.5 ${
          grow ? "min-h-0 flex-1" : "max-h-[35vh]"
        }`}
      >
        {files.length === 0 && (
          <li className="px-2 py-3 text-center font-display italic text-sm text-muted">
            none
          </li>
        )}
        {files.map((f) => {
          const active = selected?.path === f.path;
          return (
            <li key={`${title}-${f.path}`}>
              <button
                onClick={() => onPick(f)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                  active
                    ? "bg-brass/15 text-ink"
                    : "text-muted hover:bg-sunken hover:text-ink"
                }`}
              >
                <span
                  className={`${BADGE[f.type].cls} shrink-0 !px-1.5 !py-0.5`}
                  title={f.type}
                >
                  {BADGE[f.type].label}
                </span>
                <span className="truncate font-mono text-[12px]">
                  {basename(f.path)}
                </span>
                <span className="ml-auto shrink-0">
                  <LineCount added={f.added} removed={f.removed} small />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LineCount({
  added,
  removed,
  small,
}: {
  added: number | null;
  removed: number | null;
  small?: boolean;
}) {
  if (added == null && removed == null) {
    return <span className="font-mono text-[10px] text-faint">bin</span>;
  }
  const size = small ? "text-[10px]" : "text-[11px]";
  return (
    <span className={`flex items-center gap-1.5 font-mono ${size}`}>
      {added ? <span className="text-sage">+{added}</span> : null}
      {removed ? <span className="text-brick">−{removed}</span> : null}
      {!added && !removed ? <span className="text-faint">±0</span> : null}
    </span>
  );
}

function DiffView({ diff }: { diff: DiffResponse | null }) {
  if (!diff) return <EmptyState message="No diff available." />;
  if (diff.tooLargeOrBinary) {
    return <EmptyState message="Binary or oversized file — diff hidden." />;
  }
  const text = diff.untracked ? diff.body ?? "" : diff.diff ?? "";
  if (!text.trim()) {
    return <EmptyState message="No textual changes to show." />;
  }
  const lines = text.split("\n");
  return (
    <div className="h-full overflow-auto rounded-md border border-rule bg-sunken">
      <pre className="min-w-full font-mono text-[12px] leading-relaxed">
        {lines.map((line, i) => (
          <div key={i} className={`px-4 ${lineClass(line, diff.untracked)}`}>
            {line || " "}
          </div>
        ))}
      </pre>
    </div>
  );
}

function lineClass(line: string, untracked?: boolean): string {
  if (untracked) return "text-sage bg-sage/5";
  if (line.startsWith("+++") || line.startsWith("---")) return "text-faint";
  if (line.startsWith("@@")) return "text-brass bg-brass/5";
  if (line.startsWith("+")) return "text-sage bg-sage/5";
  if (line.startsWith("-")) return "text-brick bg-brick/5";
  if (line.startsWith("diff ") || line.startsWith("index "))
    return "text-faint";
  return "text-muted";
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-rule bg-sunken p-12 text-center">
      <div className="mb-2 chapter-num text-3xl">≢</div>
      <div className="font-display text-2xl italic text-muted">{message}</div>
    </div>
  );
}

function basename(p: string): string {
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(i + 1) : p;
}
