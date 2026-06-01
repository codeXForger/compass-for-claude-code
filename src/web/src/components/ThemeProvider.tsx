import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "compass-theme";
const ATTR = "data-theme";

interface ThemeCtx {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

function readPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === "light" || raw === "dark") return raw;
  return "system";
}

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>(() => readPreference());
  const [systemResolved, setSystemResolved] = useState<ResolvedTheme>(() =>
    systemTheme(),
  );

  // Listen to system-theme changes when in "system" mode.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) =>
      setSystemResolved(e.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved: ResolvedTheme = useMemo(
    () => (preference === "system" ? systemResolved : preference),
    [preference, systemResolved],
  );

  // Apply to <html> and persist.
  useEffect(() => {
    document.documentElement.setAttribute(ATTR, resolved);
  }, [resolved]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    if (p === "system") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, p);
  }, []);

  const toggle = useCallback(() => {
    setPreference(resolved === "dark" ? "light" : "dark");
  }, [resolved, setPreference]);

  return (
    <Ctx.Provider value={{ preference, resolved, setPreference, toggle }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme must be used inside <ThemeProvider>");
  return v;
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { preference, resolved, setPreference } = useTheme();
  const opts: { v: ThemePreference; label: string; glyph: string }[] = [
    { v: "light", label: "Day", glyph: "☉" },
    { v: "system", label: "Auto", glyph: "◐" },
    { v: "dark", label: "Night", glyph: "☾" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center gap-0.5 rounded-full border border-rule bg-surface p-0.5"
      title={`Theme — currently ${resolved}`}
    >
      {opts.map((o) => {
        const active = preference === o.v;
        return (
          <button
            key={o.v}
            role="radio"
            aria-checked={active}
            onClick={() => setPreference(o.v)}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              active
                ? "bg-brass/15 text-ink"
                : "text-faint hover:text-ink"
            }`}
            title={o.label}
          >
            <span
              className={`font-display text-[14px] leading-none ${
                active ? "text-brass" : "text-faint"
              }`}
            >
              {o.glyph}
            </span>
            {!compact && <span className="tracking-tight">{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
