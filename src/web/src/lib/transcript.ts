/**
 * Turns the raw `events: any[]` from `GET /api/history/:id` into a clean,
 * render-ready conversation. Pure module — no React, no I/O. Every field access
 * is guarded; unknown shapes are skipped rather than thrown, so the worst case is
 * a missing item (the raw-JSON toggle in the UI is the safety net).
 */

export type TranscriptItem =
  | { kind: "user-text"; text: string }
  | { kind: "assistant-text"; text: string }
  | { kind: "thinking"; text: string }
  | {
      kind: "tool";
      tool: string;
      label: string;
      icon: string;
      summary: string;
      input: unknown;
      result: string | null;
    };

/** Top-level event `type`s that carry no human-meaningful content. */
const NOISE_TYPES = new Set([
  "queue-operation",
  "attachment",
  "last-prompt",
  "summary",
  "unparsed",
]);

function basename(p: unknown): string {
  if (typeof p !== "string") return "";
  const parts = p.split("/");
  return parts[parts.length - 1] || p;
}

/** First short-ish string value in an input object — a best-effort summary. */
function firstStringField(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  for (const v of Object.values(input as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

/** Map a tool name + input to a plain-language label, icon, and one-line summary. */
export function toolPresentation(
  name: string,
  input: unknown,
): { label: string; icon: string; summary: string } {
  const inp = (input ?? {}) as Record<string, unknown>;
  switch (name) {
    case "Bash":
      return {
        icon: "⚙",
        label: "Ran a command",
        summary: String(inp.description ?? inp.command ?? ""),
      };
    case "Read":
      return { icon: "📄", label: "Read a file", summary: basename(inp.file_path) };
    case "Write":
      return { icon: "📝", label: "Wrote a file", summary: basename(inp.file_path) };
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit":
      return {
        icon: "✏️",
        label: "Edited a file",
        summary: basename(inp.file_path ?? inp.notebook_path),
      };
    case "Grep":
      return { icon: "🔍", label: "Searched the code", summary: String(inp.pattern ?? "") };
    case "Glob":
      return { icon: "🔍", label: "Looked for files", summary: String(inp.pattern ?? "") };
    case "LS":
      return { icon: "📁", label: "Listed a folder", summary: basename(inp.path) };
    case "Task":
    case "Agent":
      return {
        icon: "🤝",
        label: "Asked a sub-agent",
        summary: String(inp.description ?? ""),
      };
    case "WebFetch":
    case "WebSearch":
      return {
        icon: "🌐",
        label: "Searched the web",
        summary: String(inp.url ?? inp.query ?? ""),
      };
    case "TodoWrite":
      return { icon: "✅", label: "Updated the to-do list", summary: "" };
    default: {
      if (name.startsWith("mcp__")) {
        const server = name.split("__")[1] ?? "a service";
        return {
          icon: "🔌",
          label: `Used ${server}`,
          summary: firstStringField(input),
        };
      }
      // Humanize CamelCase / snake_case into spaced words.
      const human = name
        .replace(/_/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2");
      return { icon: "🛠", label: human, summary: firstStringField(input) };
    }
  }
}

/** Collapse a tool_result `content` (string | array of blocks) into plain text. */
function resultToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => {
        if (typeof b === "string") return b;
        if (b && typeof b === "object" && typeof (b as any).text === "string")
          return (b as any).text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (content == null) return "";
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
}

/**
 * Strip Claude Code wrapper noise from a user-typed string so non-technical
 * readers see the actual message. Conservative — only removes well-known
 * wrappers, never discards the whole message.
 */
function cleanUserText(raw: string): string {
  let s = raw;
  // Whole-block wrappers we can safely drop.
  s = s.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "");
  s = s.replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, "");
  s = s.replace(/<local-command-stderr>[\s\S]*?<\/local-command-stderr>/g, "");
  s = s.replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, "");
  s = s.replace(/<command-message>[\s\S]*?<\/command-message>/g, "");
  s = s.replace(/<command-args>[\s\S]*?<\/command-args>/g, "");
  // A slash-command invocation → friendly "Ran /name".
  s = s.replace(/<command-name>\s*\/?([\w-]+)\s*<\/command-name>/g, "Ran /$1");
  return s.trim();
}

export function buildTranscript(events: any[]): TranscriptItem[] {
  if (!Array.isArray(events)) return [];

  // Pass 1 — index every tool_result by its tool_use_id (results arrive in the
  // user event that follows the tool call, so a global map is required).
  const resultsById = new Map<string, string>();
  for (const ev of events) {
    const content = ev?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type === "tool_result" && typeof block.tool_use_id === "string") {
        resultsById.set(block.tool_use_id, resultToText(block.content));
      }
    }
  }

  // Pass 2 — build ordered items.
  const items: TranscriptItem[] = [];
  for (const ev of events) {
    if (NOISE_TYPES.has(ev?.type)) continue;
    const msg = ev?.message;
    if (!msg) continue;
    const role = ev.type ?? msg.role;
    const content = msg.content;

    if (typeof content === "string") {
      const text =
        role === "user" ? cleanUserText(content) : content.trim();
      if (!text) continue;
      items.push({
        kind: role === "user" ? "user-text" : "assistant-text",
        text,
      });
      continue;
    }

    if (!Array.isArray(content)) continue;

    for (const block of content) {
      const bt = block?.type;
      if (bt === "text") {
        const text =
          role === "user"
            ? cleanUserText(String(block.text ?? ""))
            : String(block.text ?? "").trim();
        if (!text) continue;
        items.push({
          kind: role === "user" ? "user-text" : "assistant-text",
          text,
        });
      } else if (bt === "thinking") {
        const text = String(block.thinking ?? "").trim();
        if (!text) continue;
        items.push({ kind: "thinking", text });
      } else if (bt === "tool_use") {
        const name = String(block.name ?? "tool");
        const { label, icon, summary } = toolPresentation(name, block.input);
        items.push({
          kind: "tool",
          tool: name,
          label,
          icon,
          summary,
          input: block.input,
          result: resultsById.get(block.id) ?? null,
        });
      }
      // tool_result blocks are skipped — already attached to their tool_use.
    }
  }

  return items;
}

/** Relative time phrase, e.g. "2 hours ago". Falls back to "just now". */
export function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (!Number.isFinite(diff) || diff < 0) return "just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  const mon = Math.floor(day / 30);
  if (mon < 12) return `${mon} month${mon === 1 ? "" : "s"} ago`;
  const yr = Math.floor(mon / 12);
  return `${yr} year${yr === 1 ? "" : "s"} ago`;
}
