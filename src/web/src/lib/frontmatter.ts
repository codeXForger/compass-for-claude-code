/**
 * Tiny client-side YAML-frontmatter helper — no dependency, scalar fields only.
 *
 * It supports the simple `key: value` frontmatter that skills and commands use.
 * Anything it can't parse (block lists, nested maps) is left untouched in the
 * body fallback, and the page's "Raw" toggle remains the escape hatch for
 * complex files. Parsed scalar keys the form doesn't manage are preserved by
 * round-tripping them back through `stringifyFrontmatter`.
 */

export interface ParsedFrontmatter {
  fields: Record<string, string>;
  body: string;
}

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const SCALAR_RE = /^([A-Za-z0-9_-]+):\s?(.*)$/;

function unquote(value: string): string {
  const v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

export function parseFrontmatter(content: string): ParsedFrontmatter {
  const match = FM_RE.exec(content);
  if (!match) return { fields: {}, body: content };
  const [, fm, body] = match;
  const fields: Record<string, string> = {};
  const lines = fm.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    // Indented lines belong to the key above (handled via look-ahead below).
    if (line.startsWith(" ") || line.startsWith("\t")) continue;
    const m = SCALAR_RE.exec(line);
    if (!m) continue;
    const key = m[1];
    const value = m[2].trim();

    if (value === "") {
      // A block list may follow: `key:` then indented `- item` lines.
      const items: string[] = [];
      let j = i + 1;
      while (j < lines.length && /^\s+-\s+/.test(lines[j])) {
        items.push(unquote(lines[j].replace(/^\s+-\s+/, "")));
        j++;
      }
      fields[key] = items.join(", ");
      i = j - 1;
      continue;
    }

    if (value.startsWith("[") && value.endsWith("]")) {
      // Inline list: `key: [a, b]`.
      fields[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => unquote(s.trim()))
        .filter(Boolean)
        .join(", ");
      continue;
    }

    fields[key] = unquote(value);
  }
  return { fields, body };
}

export function stringifyFrontmatter(
  fields: Record<string, string>,
  body: string,
): string {
  const entries = Object.entries(fields).filter(
    ([, v]) => v != null && String(v).trim() !== "",
  );
  const cleanBody = body.replace(/^\r?\n+/, "");
  if (entries.length === 0) return cleanBody;
  const lines = entries.map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join("\n")}\n---\n\n${cleanBody}`;
}
