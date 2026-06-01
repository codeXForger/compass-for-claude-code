import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { buildTranscript, timeAgo, type TranscriptItem } from "../lib/transcript";

interface SessionSummary {
  id: string;
  file: string;
  size: number;
  mtimeMs: number;
  firstUserPrompt: string | null;
  eventCount: number;
}
interface SessionDetail {
  id: string;
  file: string;
  events: any[];
}

export function History() {
  const [list, setList] = useState<
    { dir: string; sessions: SessionSummary[] } | null
  >(null);
  const [selected, setSelected] = useState<SessionSummary | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [filter, setFilter] = useState("");
  const [view, setView] = useState<"readable" | "raw">("readable");

  useEffect(() => {
    apiGet<{ dir: string; sessions: SessionSummary[] }>("/history").then(
      setList,
    );
  }, []);

  useEffect(() => {
    if (!selected) return;
    setDetail(null);
    apiGet<SessionDetail>(`/history/${selected.id}`).then(setDetail);
  }, [selected]);

  const filtered = useMemo(() => {
    if (!list) return [];
    const f = filter.toLowerCase();
    if (!f) return list.sessions;
    return list.sessions.filter(
      (s) =>
        s.id.toLowerCase().includes(f) ||
        (s.firstUserPrompt ?? "").toLowerCase().includes(f),
    );
  }, [list, filter]);

  if (!list) return <div className="text-muted">Loading…</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        chapter="X"
        eyebrow="Chapter · History"
        title="A log of voyages past"
        subtitle="every Claude session in this project"
        meta={list.dir}
      />

      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-display italic text-faint"
        >
          ⌕
        </span>
        <input
          className="field pl-9"
          placeholder="Search sessions, prompts…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 md:h-[calc(100vh-15rem)] md:min-h-0 md:grid-cols-3">
        <aside className="flex flex-col md:min-h-0">
          <div className="mb-1 flex items-center justify-between eyebrow">
            <span>Sessions</span>
            <span className="font-mono normal-case tracking-normal">
              {filtered.length}
            </span>
          </div>
          <div className="space-y-1.5 overflow-y-auto pr-1 md:min-h-0 md:flex-1">
          {filtered.length === 0 && (
            <div className="rounded-md border border-dashed border-rule bg-sunken p-4 text-center font-display italic text-muted">
              No sessions.
            </div>
          )}
          {filtered.map((s, i) => {
            const active = selected?.id === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className={`w-full rounded-md border p-3 text-left transition-colors animate-fade-in ${
                  active
                    ? "border-brass/50 bg-brass/10"
                    : "border-rule bg-surface hover:border-rule-strong"
                }`}
                style={{ animationDelay: `${i * 20}ms` }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-mono text-[11px] ${active ? "text-brass" : "text-muted"}`}
                  >
                    {s.id.slice(0, 12)}…
                  </span>
                  <span className="font-display italic text-[11px] text-faint">
                    {s.eventCount} events
                  </span>
                </div>
                <div
                  className="mt-0.5 text-[11px] text-faint"
                  title={new Date(s.mtimeMs).toLocaleString()}
                >
                  {timeAgo(s.mtimeMs)}
                </div>
                {s.firstUserPrompt && (
                  <div
                    className={`mt-1.5 line-clamp-2 text-[12px] ${
                      active ? "text-ink" : "text-muted"
                    }`}
                  >
                    {s.firstUserPrompt}
                  </div>
                )}
              </button>
            );
          })}
          </div>
        </aside>

        <section className="md:col-span-2 md:min-h-0 md:overflow-y-auto">
          {!selected ? (
            <div className="rounded-md border border-dashed border-rule bg-sunken p-10 text-center">
              <div className="font-display text-3xl italic text-muted">
                Pick a voyage from the left.
              </div>
            </div>
          ) : !detail ? (
            <div className="text-muted">Loading session…</div>
          ) : (
            <div className="space-y-2">
              <div className="card-flat sticky top-0 z-10 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] text-faint">
                      session
                    </div>
                    <div className="truncate font-mono text-sm text-ink">
                      {selected.id}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1 rounded-md border border-rule bg-sunken p-0.5">
                    <button
                      className={view === "readable" ? "tab tab-active" : "tab"}
                      onClick={() => setView("readable")}
                    >
                      Readable
                    </button>
                    <button
                      className={view === "raw" ? "tab tab-active" : "tab"}
                      onClick={() => setView("raw")}
                    >
                      Raw
                    </button>
                  </div>
                </div>
              </div>
              {view === "readable" ? (
                <ReadableTranscript events={detail.events} />
              ) : (
                <ul className="space-y-2">
                  {detail.events.map((e: any, i: number) => (
                    <li key={i} className="card animate-fade-in" style={{ animationDelay: `${Math.min(i, 12) * 20}ms` }}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="pill-quiet">
                          {e.type ?? e.role ?? "event"}
                        </span>
                        <span className="font-mono text-[10px] text-faint">
                          #{i + 1}
                        </span>
                      </div>
                      <pre className="overflow-auto whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-muted">
                        {JSON.stringify(e, null, 2).slice(0, 2000)}
                      </pre>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const RESULT_CAP = 4000;

function ReadableTranscript({ events }: { events: any[] }) {
  const items = useMemo(() => buildTranscript(events), [events]);
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-rule bg-sunken p-8 text-center font-display italic text-muted">
        This session has no readable messages yet.
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => (
        <div
          key={i}
          className="animate-fade-in"
          style={{ animationDelay: `${Math.min(i, 12) * 20}ms` }}
        >
          <TranscriptRow item={item} />
        </div>
      ))}
    </div>
  );
}

function TranscriptRow({ item }: { item: TranscriptItem }) {
  if (item.kind === "user-text") {
    return (
      <div className="rounded-md border border-brass/30 bg-brass/[0.06] p-4">
        <div className="eyebrow mb-1.5 text-brass">🧑 You</div>
        <div className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-ink">
          {item.text}
        </div>
      </div>
    );
  }

  if (item.kind === "assistant-text") {
    return (
      <div className="card-flat p-4">
        <div className="eyebrow mb-1.5">🤖 Claude</div>
        <div className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-ink">
          {item.text}
        </div>
      </div>
    );
  }

  if (item.kind === "thinking") {
    return (
      <details className="rounded-md border border-rule bg-sunken px-4 py-2.5">
        <summary className="cursor-pointer select-none font-display italic text-[13px] text-faint">
          💭 Claude's thinking
        </summary>
        <div className="mt-2 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-muted">
          {item.text}
        </div>
      </details>
    );
  }

  // Tool step.
  const result =
    item.result && item.result.length > RESULT_CAP
      ? item.result.slice(0, RESULT_CAP) + "\n… (truncated)"
      : item.result;
  return (
    <details className="rounded-md border border-rule bg-surface px-4 py-2.5">
      <summary className="flex cursor-pointer select-none items-baseline gap-2 text-[12.5px] text-muted">
        <span aria-hidden>{item.icon}</span>
        <span className="font-medium text-ink">{item.label}</span>
        {item.summary && (
          <span className="truncate font-mono text-[11.5px] text-faint">
            · {item.summary}
          </span>
        )}
      </summary>
      <div className="mt-2.5 space-y-2">
        <div>
          <div className="eyebrow mb-1">Details</div>
          <pre className="overflow-auto whitespace-pre-wrap break-words rounded border border-rule bg-sunken p-2.5 font-mono text-[11px] leading-relaxed text-muted">
            {JSON.stringify(item.input, null, 2)}
          </pre>
        </div>
        {result != null && result !== "" && (
          <div>
            <div className="eyebrow mb-1">Result</div>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded border border-rule bg-sunken p-2.5 font-mono text-[11px] leading-relaxed text-muted">
              {result}
            </pre>
          </div>
        )}
      </div>
    </details>
  );
}
