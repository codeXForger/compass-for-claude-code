import { useState } from "react";
import { apiPost } from "../lib/api";
import { useToast } from "./ToastProvider";

interface Props {
  /** Config surface the field belongs to, e.g. "commands". */
  module: string;
  /** Human label of the field being rephrased, e.g. "Description". */
  field: string;
  /** Current field value to rephrase. */
  value: string;
  /** Called with the rephrased text when the user clicks Apply. */
  onApply: (text: string) => void;
}

/**
 * Small icon control next to a free-text field. Sends the field's content to
 * the `claude` CLI (via /api/rephrase), then previews the suggestion with
 * Apply / Discard before it overwrites the field. The owning page keeps state —
 * this component only calls back through `onApply`.
 */
export function RephraseButton({ module, field, value, onApply }: Props) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  async function run() {
    if (loading) return;
    setLoading(true);
    try {
      const r = await apiPost<{ text: string }>("/rephrase", {
        module,
        field,
        content: value,
      });
      setSuggestion(r.text);
    } catch (e) {
      toast.error(e instanceof Error ? e.message.replace(/^Error:\s*/, "") : String(e));
    } finally {
      setLoading(false);
    }
  }

  function apply() {
    if (suggestion !== null) onApply(suggestion);
    setSuggestion(null);
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        className="btn-quiet px-2 py-1"
        onClick={run}
        disabled={loading || !value.trim()}
        title="Rephrase with Claude"
        aria-busy={loading}
      >
        {loading ? <Spinner /> : <WandIcon />}
      </button>

      {suggestion !== null && (
        <div className="card absolute right-0 z-20 mt-2 w-80 space-y-3 shadow-lg">
          <div className="eyebrow">Suggestion · {field}</div>
          <p className="max-h-72 overflow-auto whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
            {suggestion}
          </p>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={apply}>
              Apply
            </button>
            <button className="btn-ghost" onClick={() => setSuggestion(null)}>
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function WandIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 3v4M3 5h4M6 17v4M4 19h4" />
      <path d="M13 4 9 8l11 11 4-4L13 4z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="h-3.5 w-3.5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-90"
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
