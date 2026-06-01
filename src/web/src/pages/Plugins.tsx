import { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { useToast } from "../components/ToastProvider";

type Scope = "user" | "project" | "local";

interface PluginEntry {
  id: string;
  version?: string;
  scope: Scope;
  enabled: boolean;
  installPath?: string;
  installedAt?: string;
  lastUpdated?: string;
  projectPath?: string;
  mcpServers?: Record<string, unknown>;
}

interface MarketplaceEntry {
  name: string;
  source?: { source: string; repo?: string; url?: string; path?: string };
  installLocation?: string;
  lastUpdated?: string;
}

interface PluginListResponse {
  installed: PluginEntry[];
  available: PluginEntry[];
}

interface MarketplaceListResponse {
  marketplaces: MarketplaceEntry[];
}

export function Plugins() {
  const [plugins, setPlugins] = useState<PluginEntry[] | null>(null);
  const [marketplaces, setMarketplaces] = useState<MarketplaceEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  // install form
  const [installing, setInstalling] = useState(false);
  const [installPlugin, setInstallPlugin] = useState("");
  const [installScope, setInstallScope] = useState<Scope>("user");

  // marketplace form
  const [addingMarket, setAddingMarket] = useState(false);
  const [marketSource, setMarketSource] = useState("");
  const [marketScope, setMarketScope] = useState<Scope>("user");

  function refresh() {
    setErr(null);
    apiGet<PluginListResponse>("/plugins")
      .then((r) => setPlugins(r.installed))
      .catch((e) => setErr(String(e)));
    apiGet<MarketplaceListResponse>("/plugins/marketplaces/list")
      .then((r) => setMarketplaces(r.marketplaces))
      .catch((e) => setErr(String(e)));
  }
  useEffect(refresh, []);

  async function withBusy(
    key: string,
    fn: () => Promise<unknown>,
    successText: string,
  ) {
    setBusy(key);
    setErr(null);
    try {
      await fn();
      toast.success(successText);
      refresh();
    } catch (e) {
      toast.error(String(e).replace(/^Error:\s*/, ""));
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  function uninstall(p: PluginEntry) {
    if (!confirm(`Uninstall "${p.id}" (${p.scope})?`)) return;
    void withBusy(
      `uninstall:${p.id}:${p.scope}`,
      () =>
        apiDelete(
          `/plugins/${encodeURIComponent(p.id)}?scope=${encodeURIComponent(p.scope)}`,
        ),
      `Uninstalled "${p.id}".`,
    );
  }
  function toggle(p: PluginEntry) {
    const action = p.enabled ? "disable" : "enable";
    void withBusy(
      `${action}:${p.id}:${p.scope}`,
      () =>
        apiPost(`/plugins/${encodeURIComponent(p.id)}/${action}`, {
          scope: p.scope,
        }),
      `${p.enabled ? "Disabled" : "Enabled"} "${p.id}".`,
    );
  }
  function update(p: PluginEntry) {
    void withBusy(
      `update:${p.id}:${p.scope}`,
      () => apiPost(`/plugins/${encodeURIComponent(p.id)}/update`, {}),
      `Updated "${p.id}".`,
    );
  }

  async function doInstall() {
    if (!installPlugin.trim()) return;
    await withBusy(
      "install",
      () =>
        apiPost(`/plugins`, {
          plugin: installPlugin.trim(),
          scope: installScope,
        }),
      `Installed "${installPlugin.trim()}".`,
    );
    setInstallPlugin("");
    setInstalling(false);
  }

  async function addMarketplace() {
    if (!marketSource.trim()) return;
    await withBusy(
      "addMarket",
      () =>
        apiPost(`/plugins/marketplaces`, {
          source: marketSource.trim(),
          scope: marketScope,
        }),
      `Added marketplace "${marketSource.trim()}".`,
    );
    setMarketSource("");
    setAddingMarket(false);
  }

  function removeMarketplace(name: string) {
    if (!confirm(`Remove marketplace "${name}"?`)) return;
    void withBusy(
      `rmMarket:${name}`,
      () => apiDelete(`/plugins/marketplaces/${encodeURIComponent(name)}`),
      `Removed marketplace "${name}".`,
    );
  }

  function updateMarketplace(name: string) {
    void withBusy(
      `upMarket:${name}`,
      () =>
        apiPost(`/plugins/marketplaces/${encodeURIComponent(name)}/update`, {}),
      `Updated marketplace "${name}".`,
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        chapter="XI"
        eyebrow="Chapter · Plugins"
        title="Cargo from distant ports"
        subtitle={
          <>
            managed via <code className="font-mono not-italic text-ink">claude plugin</code>
          </>
        }
        actions={
          !installing && (
            <button className="btn-primary" onClick={() => setInstalling(true)}>
              + Install plugin
            </button>
          )
        }
      />

      {err && (
        <div className="rounded-md border border-brick/40 bg-brick/10 p-3 text-sm text-brick">
          {err}
        </div>
      )}

      {installing && (
        <div className="card space-y-4 animate-page-in">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl text-ink">Install plugin</h2>
            <button className="btn-quiet" onClick={() => setInstalling(false)}>
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="label">Plugin · use plugin@marketplace</label>
              <input
                className="field-mono"
                placeholder="frontend-design@claude-plugins-official"
                value={installPlugin}
                onChange={(e) => setInstallPlugin(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Scope</label>
              <select
                className="field"
                value={installScope}
                onChange={(e) => setInstallScope(e.target.value as Scope)}
              >
                <option value="user">user</option>
                <option value="project">project</option>
                <option value="local">local</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className="btn-primary"
              onClick={doInstall}
              disabled={busy === "install" || !installPlugin.trim()}
            >
              {busy === "install" ? "Installing…" : "Install"}
            </button>
            <button className="btn-ghost" onClick={() => setInstalling(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="eyebrow mb-3">Installed plugins</h2>
        {!plugins ? (
          <div className="text-sm text-muted">Loading…</div>
        ) : plugins.length === 0 ? (
          <div className="rounded-md border border-dashed border-rule bg-sunken p-6 text-center">
            <div className="font-display text-2xl italic text-muted">
              No plugins installed.
            </div>
            <div className="mt-2 text-xs text-faint">
              Add a marketplace below, then install plugins from it.
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {plugins.map((p, i) => {
              const key = `${p.id}::${p.scope}`;
              const toggleBusy =
                busy === `enable:${p.id}:${p.scope}` ||
                busy === `disable:${p.id}:${p.scope}`;
              const updateBusy = busy === `update:${p.id}:${p.scope}`;
              const uninstallBusy = busy === `uninstall:${p.id}:${p.scope}`;
              return (
                <li
                  key={key}
                  className="flex items-start justify-between gap-3 rounded-md border border-rule bg-surface px-4 py-3 transition-colors hover:border-brass/40 animate-fade-in"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-lg text-brass">⌬</span>
                      <span className="font-mono text-sm text-ink">{p.id}</span>
                      <span
                        className={
                          p.enabled
                            ? "pill-sage text-[10px]"
                            : "pill-quiet text-[10px]"
                        }
                      >
                        <span
                          className={`dot ${p.enabled ? "bg-sage" : "bg-faint"}`}
                        />
                        {p.enabled ? "enabled" : "disabled"}
                      </span>
                      <span className="pill-quiet text-[10px]">{p.scope}</span>
                      {p.version && p.version !== "unknown" && (
                        <span className="font-mono text-[10.5px] text-faint">
                          v{p.version}
                        </span>
                      )}
                    </div>
                    {p.installPath && (
                      <div className="mt-1 truncate font-mono text-[11px] text-faint">
                        {p.installPath}
                      </div>
                    )}
                    {p.projectPath && (
                      <div className="mt-0.5 truncate font-mono text-[10.5px] text-faint">
                        scope project: {p.projectPath}
                      </div>
                    )}
                    {p.mcpServers && Object.keys(p.mcpServers).length > 0 && (
                      <div className="mt-1 text-[11px] text-muted">
                        bundles MCP: {Object.keys(p.mcpServers).join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                    <div className="flex gap-1.5">
                      <button
                        className="btn-ghost"
                        onClick={() => toggle(p)}
                        disabled={toggleBusy}
                        title={p.enabled ? "Disable plugin" : "Enable plugin"}
                      >
                        {toggleBusy
                          ? "…"
                          : p.enabled
                            ? "Disable"
                            : "Enable"}
                      </button>
                      <button
                        className="btn-ghost"
                        onClick={() => update(p)}
                        disabled={updateBusy}
                        title="Pull latest from marketplace"
                      >
                        {updateBusy ? "…" : "Update"}
                      </button>
                      <button
                        className="btn-danger"
                        onClick={() => uninstall(p)}
                        disabled={uninstallBusy}
                      >
                        {uninstallBusy ? "…" : "Uninstall"}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="eyebrow">Marketplaces</h2>
          {!addingMarket && (
            <button className="btn-ghost" onClick={() => setAddingMarket(true)}>
              + Add marketplace
            </button>
          )}
        </div>

        {addingMarket && (
          <div className="mb-4 space-y-3 rounded-md border border-rule bg-sunken p-4 animate-page-in">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="label">
                  Source · GitHub repo, URL, or path
                </label>
                <input
                  className="field-mono"
                  placeholder="anthropics/claude-plugins-official"
                  value={marketSource}
                  onChange={(e) => setMarketSource(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Scope</label>
                <select
                  className="field"
                  value={marketScope}
                  onChange={(e) => setMarketScope(e.target.value as Scope)}
                >
                  <option value="user">user</option>
                  <option value="project">project</option>
                  <option value="local">local</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="btn-primary"
                onClick={addMarketplace}
                disabled={busy === "addMarket" || !marketSource.trim()}
              >
                {busy === "addMarket" ? "Adding…" : "Add"}
              </button>
              <button
                className="btn-ghost"
                onClick={() => setAddingMarket(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!marketplaces ? (
          <div className="text-sm text-muted">Loading…</div>
        ) : marketplaces.length === 0 ? (
          <div className="rounded-md border border-dashed border-rule bg-sunken p-6 text-center">
            <div className="font-display italic text-muted">
              No marketplaces configured.
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {marketplaces.map((m) => {
              const updateBusy = busy === `upMarket:${m.name}`;
              const removeBusy = busy === `rmMarket:${m.name}`;
              const sourceLabel =
                m.source?.repo ||
                m.source?.url ||
                m.source?.path ||
                m.source?.source ||
                "";
              return (
                <li
                  key={m.name}
                  className="flex items-center justify-between gap-3 rounded-md border border-rule bg-surface px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-base text-brass">⊕</span>
                      <span className="font-mono text-sm text-ink">{m.name}</span>
                      {m.source?.source && (
                        <span className="pill-quiet text-[10px]">
                          {m.source.source}
                        </span>
                      )}
                    </div>
                    {sourceLabel && (
                      <div className="mt-1 truncate font-mono text-[11px] text-faint">
                        {sourceLabel}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 gap-1.5">
                    <button
                      className="btn-ghost"
                      onClick={() => updateMarketplace(m.name)}
                      disabled={updateBusy}
                    >
                      {updateBusy ? "…" : "Update"}
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => removeMarketplace(m.name)}
                      disabled={removeBusy}
                    >
                      {removeBusy ? "…" : "Remove"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
