import { useEffect, useState } from "react";
import { apiGet, projectNameFromCwd } from "../lib/api";
import { PageHeader } from "../components/PageHeader";

interface DirEntry {
  name: string;
  path: string;
  type: "dir" | "file";
}
interface ListResponse {
  cwd: string;
  path: string;
  entries: DirEntry[];
}
interface ContentResponse {
  path: string;
  size: number;
  content: string | null;
  binary?: boolean;
  tooLarge?: boolean;
}

export function Files() {
  const [root, setRoot] = useState<ListResponse | null>(null);
  const [selected, setSelected] = useState<DirEntry | null>(null);
  const [file, setFile] = useState<ContentResponse | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);

  useEffect(() => {
    apiGet<ListResponse>("/files").then(setRoot);
  }, []);

  useEffect(() => {
    if (!selected) return;
    setFile(null);
    setLoadingFile(true);
    apiGet<ContentResponse>(
      `/files/content?path=${encodeURIComponent(selected.path)}`,
    )
      .then(setFile)
      .finally(() => setLoadingFile(false));
  }, [selected]);

  if (!root) return <div className="text-muted">Loading…</div>;

  const projectName = projectNameFromCwd(root.cwd);

  return (
    <div className="space-y-6">
      <PageHeader
        chapter="XIII"
        eyebrow={`Chapter · Files · ${projectName}`}
        title="The lay of the land"
        subtitle="browse the project tree — click a file to read it"
        meta={`◉ ${projectName} — ${root.cwd}`}
      />

      <div className="grid grid-cols-1 gap-5 md:h-[calc(100vh-16rem)] md:grid-cols-3 md:grid-rows-[minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col md:col-span-1">
          <div className="mb-2 flex shrink-0 items-center justify-between eyebrow">
            <span>Project tree</span>
            <span className="font-mono normal-case tracking-normal text-faint">
              {root.entries.length}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded-md border border-rule bg-surface p-1.5">
            {root.entries.length === 0 ? (
              <div className="px-2 py-3 text-center font-display italic text-sm text-muted">
                empty
              </div>
            ) : (
              <ul>
                {root.entries.map((e) => (
                  <TreeNode
                    key={e.path}
                    entry={e}
                    depth={0}
                    selectedPath={selected?.path ?? null}
                    onSelect={setSelected}
                  />
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col gap-3 md:col-span-2">
          {!selected ? (
            <EmptyState message="Select a file to read its contents." />
          ) : (
            <>
              <div className="card-flat flex shrink-0 items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="chapter-num text-lg">§</span>
                    <span className="truncate font-display text-2xl text-ink">
                      {selected.name}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[11px] text-faint">
                    {selected.path}
                  </div>
                </div>
                {file && file.size != null && (
                  <span className="pill-quiet shrink-0">
                    {formatBytes(file.size)}
                  </span>
                )}
              </div>

              <div className="min-h-0 flex-1">
                {loadingFile ? (
                  <div className="text-muted">Loading file…</div>
                ) : file?.binary ? (
                  <EmptyState message="Binary file — nothing to show." />
                ) : file?.tooLarge ? (
                  <EmptyState message="File too large to preview (over 2 MB)." />
                ) : (
                  <FileView content={file?.content ?? ""} />
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function TreeNode({
  entry,
  depth,
  selectedPath,
  onSelect,
}: {
  entry: DirEntry;
  depth: number;
  selectedPath: string | null;
  onSelect: (e: DirEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<DirEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (entry.type === "file") {
      onSelect(entry);
      return;
    }
    if (!open && children === null) {
      setLoading(true);
      try {
        const r = await apiGet<ListResponse>(
          `/files?path=${encodeURIComponent(entry.path)}`,
        );
        setChildren(r.entries);
      } finally {
        setLoading(false);
      }
    }
    setOpen((o) => !o);
  }

  const isActive = entry.type === "file" && selectedPath === entry.path;

  return (
    <li>
      <button
        onClick={toggle}
        className={`flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-[13px] transition-colors ${
          isActive
            ? "bg-brass/15 text-ink"
            : "text-muted hover:bg-sunken hover:text-ink"
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        <span className="w-3 shrink-0 text-center font-mono text-[10px] text-faint">
          {entry.type === "dir" ? (open ? "▾" : "▸") : ""}
        </span>
        <span aria-hidden className="shrink-0 text-faint">
          {entry.type === "dir" ? "▦" : "·"}
        </span>
        <span className="truncate">{entry.name}</span>
        {loading && (
          <span className="ml-auto font-mono text-[10px] text-faint">…</span>
        )}
      </button>
      {entry.type === "dir" && open && children && (
        <ul>
          {children.length === 0 ? (
            <li
              className="py-0.5 font-display italic text-[12px] text-faint"
              style={{ paddingLeft: `${(depth + 1) * 14 + 26}px` }}
            >
              empty
            </li>
          ) : (
            children.map((child) => (
              <TreeNode
                key={child.path}
                entry={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            ))
          )}
        </ul>
      )}
    </li>
  );
}

function FileView({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="h-full overflow-auto rounded-md border border-rule bg-sunken">
      <table className="w-full border-collapse font-mono text-[12px] leading-relaxed">
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className="align-top">
              <td className="select-none border-r border-rule px-3 text-right text-faint">
                {i + 1}
              </td>
              <td className="whitespace-pre-wrap break-words px-3 text-ink">
                {line || " "}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-rule bg-sunken p-12 text-center">
      <div className="mb-2 chapter-num text-3xl">§</div>
      <div className="font-display text-2xl italic text-muted">{message}</div>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
