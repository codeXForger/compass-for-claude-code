import { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPut } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { ActionButton, SkipError } from "../components/ActionButton";
import { MetadataForm, FieldSpec } from "../components/MetadataForm";
import { RephraseButton } from "../components/RephraseButton";
import { parseFrontmatter, stringifyFrontmatter } from "../lib/frontmatter";

interface Entry {
  name: string;
  scope: "project" | "user";
  path: string;
}
interface ListResponse {
  project: Entry[];
  user: Entry[];
}

type Mode = "form" | "raw";

interface Props {
  title: string;
  description: string;
  resource: "commands" | "agents";
  template: (name: string) => string;
  chapter?: string;
  eyebrow?: string;
  subtitle?: React.ReactNode;
  glyph?: string;
  /** When provided, render a metadata form + body editor with a Raw toggle. */
  fields?: FieldSpec[];
  /** Label for the markdown body editor in form mode. */
  bodyLabel?: string;
}

export function FileResourcePage({
  title,
  description,
  resource,
  template,
  chapter,
  eyebrow,
  subtitle,
  glyph,
  fields,
  bodyLabel = "Body",
}: Props) {
  const [data, setData] = useState<ListResponse | null>(null);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<Mode>("form");
  const [values, setValues] = useState<Record<string, string>>({});
  const [body, setBody] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newScope, setNewScope] = useState<"project" | "user">("project");

  function refresh() {
    apiGet<ListResponse>(`/${resource}`).then(setData);
  }
  useEffect(refresh, [resource]);

  useEffect(() => {
    if (!selected) return;
    apiGet<{ content: string }>(
      `/${resource}/${selected.scope}/${selected.name}`,
    ).then((r) => {
      setDraft(r.content);
      if (fields) {
        const parsed = parseFrontmatter(r.content);
        setValues(parsed.fields);
        setBody(parsed.body);
      }
    });
  }, [selected, resource]);

  function switchMode(next: Mode) {
    if (next === mode) return;
    if (next === "raw") {
      setDraft(stringifyFrontmatter(values, body));
    } else {
      const parsed = parseFrontmatter(draft);
      setValues(parsed.fields);
      setBody(parsed.body);
    }
    setMode(next);
  }

  async function save() {
    if (!selected) return;
    const content =
      fields && mode === "form" ? stringifyFrontmatter(values, body) : draft;
    await apiPut(`/${resource}/${selected.scope}/${selected.name}`, {
      content,
    });
    refresh();
  }

  async function remove() {
    if (!selected) return;
    if (!confirm(`Delete "${selected.name}" (${selected.scope})?`)) {
      throw new SkipError();
    }
    await apiDelete(`/${resource}/${selected.scope}/${selected.name}`);
    setSelected(null);
    refresh();
  }

  async function create() {
    if (!newName.trim()) throw new SkipError();
    await apiPut(`/${resource}/${newScope}/${newName}`, {
      content: template(newName),
    });
    setCreating(false);
    setNewName("");
    refresh();
  }

  const itemNoun = resource.replace(/s$/, "");
  const displayGlyph = glyph ?? "◉";

  if (!data) return <div className="text-muted">Loading…</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        chapter={chapter}
        eyebrow={eyebrow ?? `Chapter · ${title}`}
        title={title}
        subtitle={subtitle ?? description}
        actions={
          !creating && (
            <button className="btn-primary" onClick={() => setCreating(true)}>
              + New {itemNoun}
            </button>
          )
        }
      />

      {creating && (
        <div className="card flex flex-wrap items-end gap-3 animate-page-in">
          <div className="flex-1 min-w-[200px]">
            <label className="label">Name</label>
            <input
              className="field font-mono"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`my-${itemNoun}`}
            />
          </div>
          <div className="w-44">
            <label className="label">Scope</label>
            <select
              className="field"
              value={newScope}
              onChange={(e) =>
                setNewScope(e.target.value as "project" | "user")
              }
            >
              <option value="project">project</option>
              <option value="user">user</option>
            </select>
          </div>
          <ActionButton
            onAction={create}
            loadingText="Creating…"
            successText={`${itemNoun} created.`}
          >
            Create
          </ActionButton>
          <button className="btn-ghost" onClick={() => setCreating(false)}>
            Cancel
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <aside className="space-y-6">
          <ListSection
            title="Project"
            count={data.project.length}
            items={data.project}
            onPick={setSelected}
            active={selected}
          />
          <ListSection
            title="User"
            count={data.user.length}
            items={data.user}
            onPick={setSelected}
            active={selected}
          />
        </aside>

        <section className="space-y-3 md:col-span-2">
          {selected ? (
            <>
              <div className="card-flat flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="chapter-num text-lg">{displayGlyph}</span>
                    <span className="font-display text-2xl text-ink">
                      {selected.name}
                    </span>
                    <span className="pill-quiet">{selected.scope}</span>
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-faint">
                    {selected.path}
                  </div>
                </div>
                <div className="flex gap-2">
                  <ActionButton
                    variant="danger"
                    onAction={remove}
                    loadingText="Deleting…"
                    successText={`${selected.name} deleted.`}
                  >
                    Delete
                  </ActionButton>
                  <ActionButton
                    onAction={save}
                    loadingText="Saving…"
                    successText="Saved."
                  >
                    Save
                  </ActionButton>
                </div>
              </div>
              {fields && (
                <div className="inline-flex rounded-md border border-rule bg-surface p-1">
                  <button
                    onClick={() => switchMode("form")}
                    className={`tab ${mode === "form" ? "tab-active" : ""}`}
                  >
                    Form
                  </button>
                  <button
                    onClick={() => switchMode("raw")}
                    className={`tab ${mode === "raw" ? "tab-active" : ""}`}
                  >
                    Raw markdown · advanced
                  </button>
                </div>
              )}

              {fields && mode === "form" ? (
                <div className="card space-y-4">
                  <MetadataForm
                    fields={fields}
                    values={values}
                    module={resource}
                    onChange={(k, v) =>
                      setValues((prev) => ({ ...prev, [k]: v }))
                    }
                  />
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="label mb-0">{bodyLabel}</label>
                      <RephraseButton
                        module={resource}
                        field={bodyLabel}
                        value={body}
                        onApply={setBody}
                      />
                    </div>
                    <textarea
                      className="field-mono h-[40vh] leading-relaxed"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      spellCheck={false}
                    />
                  </div>
                </div>
              ) : (
                <textarea
                  className="field-mono h-[60vh] leading-relaxed"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  spellCheck={false}
                />
              )}
            </>
          ) : (
            <EmptyState glyph={displayGlyph} itemNoun={itemNoun} />
          )}
        </section>
      </div>
    </div>
  );
}

function ListSection({
  title,
  count,
  items,
  onPick,
  active,
}: {
  title: string;
  count: number;
  items: Entry[];
  onPick: (s: Entry) => void;
  active: Entry | null;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between eyebrow">
        <span>{title}</span>
        <span className="font-mono normal-case tracking-normal text-faint">
          {count}
        </span>
      </div>
      <ul className="space-y-1 rounded-md border border-rule bg-surface p-1.5">
        {items.length === 0 && (
          <li className="px-2 py-3 text-center font-display italic text-sm text-muted">
            none
          </li>
        )}
        {items.map((s) => {
          const isActive =
            active?.name === s.name && active?.scope === s.scope;
          return (
            <li key={`${s.scope}-${s.name}`}>
              <button
                onClick={() => onPick(s)}
                className={`w-full rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                  isActive
                    ? "bg-brass/15 text-ink"
                    : "text-muted hover:bg-sunken hover:text-ink"
                }`}
              >
                {s.name}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EmptyState({
  glyph,
  itemNoun,
}: {
  glyph: string;
  itemNoun: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-rule bg-sunken p-12 text-center">
      <div className="mb-2 chapter-num text-3xl">{glyph}</div>
      <div className="font-display text-2xl italic text-muted">
        Select a {itemNoun}, or create a new one.
      </div>
    </div>
  );
}
