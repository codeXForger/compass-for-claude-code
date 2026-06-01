import { RephraseButton } from "./RephraseButton";

export type FieldType = "text" | "tools-csv" | "model";

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  help?: string;
  placeholder?: string;
  /** Show a "rephrase with Claude" control beside this text field. */
  rephrase?: boolean;
}

/** Tools commonly scoped via `allowed-tools` / `tools`. */
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

const MODELS: { value: string; label: string }[] = [
  { value: "", label: "Default (inherit)" },
  { value: "claude-opus-4-8", label: "Opus 4.8" },
  { value: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
];

/**
 * Controlled form rendering a list of frontmatter fields. `values` may carry
 * extra keys the spec doesn't render — they're preserved by the caller on save.
 */
export function MetadataForm({
  fields,
  values,
  onChange,
  module,
}: {
  fields: FieldSpec[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  /** Config surface these fields belong to — enables rephrase controls. */
  module?: string;
}) {
  return (
    <div className="space-y-4">
      {fields.map((f) => (
        <div key={f.key}>
          <label className="label">{f.label}</label>
          {f.type === "text" && (
            <div className="flex items-start gap-2">
              <input
                className="field"
                value={values[f.key] ?? ""}
                placeholder={f.placeholder}
                onChange={(e) => onChange(f.key, e.target.value)}
              />
              {f.rephrase && module && (
                <RephraseButton
                  module={module}
                  field={f.label}
                  value={values[f.key] ?? ""}
                  onApply={(t) => onChange(f.key, t)}
                />
              )}
            </div>
          )}
          {f.type === "model" && (
            <ModelSelect
              value={values[f.key] ?? ""}
              onChange={(v) => onChange(f.key, v)}
            />
          )}
          {f.type === "tools-csv" && (
            <ToolsCsv
              value={values[f.key] ?? ""}
              onChange={(v) => onChange(f.key, v)}
            />
          )}
          {f.help && <p className="mt-1 text-[11.5px] text-muted">{f.help}</p>}
        </div>
      ))}
    </div>
  );
}

function ModelSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const known = MODELS.some((m) => m.value === value);
  return (
    <select
      className="field"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {MODELS.map((m) => (
        <option key={m.value} value={m.value}>
          {m.label}
        </option>
      ))}
      {/* Preserve a custom/unknown model id already in the file. */}
      {!known && value && <option value={value}>{value}</option>}
    </select>
  );
}

function ToolsCsv({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const tokens = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const commonChecked = COMMON_TOOLS.filter((t) => tokens.includes(t));
  const customStr = tokens.filter((t) => !COMMON_TOOLS.includes(t)).join(", ");

  function rebuild(common: string[], custom: string) {
    const customTokens = custom
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onChange([...common, ...customTokens].join(", "));
  }

  function toggle(t: string) {
    const next = commonChecked.includes(t)
      ? commonChecked.filter((x) => x !== t)
      : [...commonChecked, t];
    const ordered = COMMON_TOOLS.filter((x) => next.includes(x));
    rebuild(ordered, customStr);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {COMMON_TOOLS.map((t) => (
          <label
            key={t}
            className="flex cursor-pointer items-center gap-2 text-sm text-ink"
          >
            <input
              type="checkbox"
              className="accent-brass"
              checked={commonChecked.includes(t)}
              onChange={() => toggle(t)}
            />
            <span className="font-mono text-[12px]">{t}</span>
          </label>
        ))}
      </div>
      <input
        className="field-mono mt-3"
        placeholder="custom · e.g. Bash(git add:*), mcp__server__tool"
        value={customStr}
        onChange={(e) => rebuild(commonChecked, e.target.value)}
      />
    </div>
  );
}
