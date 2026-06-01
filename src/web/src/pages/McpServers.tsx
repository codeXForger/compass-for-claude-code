import { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { ActionButton, SkipError } from "../components/ActionButton";

interface McpListResponse {
  raw: string;
  servers: { name: string; summary: string }[];
}

export function McpServers() {
  const [list, setList] = useState<McpListResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState("");
  const [transport, setTransport] = useState<"stdio" | "http" | "sse">("stdio");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [url, setUrl] = useState("");
  const [envText, setEnvText] = useState("");
  const [scope, setScope] = useState<"project" | "user" | "local">("user");

  function refresh() {
    setErr(null);
    apiGet<McpListResponse>("/mcp")
      .then(setList)
      .catch((e) => setErr(String(e)));
  }
  useEffect(refresh, []);

  async function remove(serverName: string) {
    if (!confirm(`Remove MCP server "${serverName}"?`)) throw new SkipError();
    await apiDelete(`/mcp/${encodeURIComponent(serverName)}`);
    refresh();
  }

  async function add() {
    setErr(null);
    const env: Record<string, string> = {};
    for (const line of envText.split(/\r?\n/)) {
      const m = line.match(/^([^=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2];
    }
    await apiPost("/mcp", {
      name,
      transport,
      command: transport === "stdio" ? command : undefined,
      args:
        transport === "stdio" ? args.split(/\s+/).filter(Boolean) : undefined,
      url: transport !== "stdio" ? url : undefined,
      env,
      scope,
    });
    setCreating(false);
    setName("");
    setCommand("");
    setArgs("");
    setUrl("");
    setEnvText("");
    refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        chapter="VIII"
        eyebrow="Chapter · MCP Servers"
        title="Bridges to other worlds"
        subtitle={<>managed via <code className="font-mono not-italic text-ink">claude mcp</code></>}
        actions={
          !creating && (
            <button className="btn-primary" onClick={() => setCreating(true)}>
              + Add server
            </button>
          )
        }
      />

      {err && (
        <div className="rounded-md border border-brick/40 bg-brick/10 p-3 text-sm text-brick">
          {err}
        </div>
      )}

      {creating && (
        <div className="card space-y-4 animate-page-in">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl text-ink">New MCP server</h2>
            <button
              className="btn-quiet"
              onClick={() => setCreating(false)}
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="label">Name</label>
              <input
                className="field font-mono"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="filesystem"
              />
            </div>
            <div>
              <label className="label">Transport</label>
              <select
                className="field"
                value={transport}
                onChange={(e) =>
                  setTransport(e.target.value as typeof transport)
                }
              >
                <option value="stdio">stdio</option>
                <option value="http">http</option>
                <option value="sse">sse</option>
              </select>
            </div>
            <div>
              <label className="label">Scope</label>
              <select
                className="field"
                value={scope}
                onChange={(e) => setScope(e.target.value as typeof scope)}
              >
                <option value="user">user</option>
                <option value="project">project</option>
                <option value="local">local</option>
              </select>
            </div>
          </div>
          {transport === "stdio" ? (
            <>
              <div>
                <label className="label">Command</label>
                <input
                  className="field-mono"
                  placeholder="npx"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Args · space-separated</label>
                <input
                  className="field-mono"
                  placeholder="-y @modelcontextprotocol/server-filesystem /path"
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div>
              <label className="label">URL</label>
              <input
                className="field-mono"
                placeholder="https://mcp.example.com/mcp"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="label">Env vars · KEY=value per line</label>
            <textarea
              className="field-mono h-20 text-[12px]"
              value={envText}
              onChange={(e) => setEnvText(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <ActionButton
              onAction={add}
              disabled={!name}
              loadingText="Adding…"
              successText={`Added "${name}".`}
            >
              Add server
            </ActionButton>
            <button className="btn-ghost" onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="eyebrow mb-3">Configured servers</h2>
        {!list ? (
          <div className="text-sm text-muted">Loading…</div>
        ) : list.servers.length === 0 ? (
          <div className="rounded-md border border-dashed border-rule bg-sunken p-6 text-center">
            <div className="font-display text-2xl italic text-muted">
              No bridges configured.
            </div>
            <pre className="mt-3 whitespace-pre-wrap font-mono text-[11px] text-faint">
              {list.raw || ""}
            </pre>
          </div>
        ) : (
          <ul className="space-y-2">
            {list.servers.map((s, i) => (
              <li
                key={s.name}
                className="flex items-center justify-between rounded-md border border-rule bg-surface px-4 py-3 transition-colors hover:border-brass/40 animate-fade-in"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg text-brass">⇄</span>
                    <span className="font-mono text-sm text-ink">{s.name}</span>
                  </div>
                  <div className="mt-1 truncate text-[11.5px] text-muted">
                    {s.summary}
                  </div>
                </div>
                <ActionButton
                  variant="danger"
                  onAction={() => remove(s.name)}
                  loadingText="Removing…"
                  successText={`Removed "${s.name}".`}
                >
                  Remove
                </ActionButton>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
