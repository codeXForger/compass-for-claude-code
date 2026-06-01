import { useEffect, useRef, useState } from "react";
import { useToast } from "./ToastProvider";

/**
 * Throw this from an `onAction` to abort silently — no success or error toast.
 * Useful for cancelled confirm() dialogs or empty-input guards.
 */
export class SkipError extends Error {}

type Variant = "primary" | "danger" | "ghost" | "quiet";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "btn-primary",
  danger: "btn-danger",
  ghost: "btn-ghost",
  quiet: "btn-quiet",
};

interface ActionButtonProps {
  /**
   * The async work to run. Throw (or reject) to surface an error toast.
   * If it resolves to a string, that string is used as the success toast.
   */
  onAction: () => Promise<unknown> | unknown;
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  /** Label shown while the action is running (defaults to the children). */
  loadingText?: React.ReactNode;
  /** Toast message shown when the action resolves. */
  successText?: string;
  disabled?: boolean;
  title?: string;
}

export function ActionButton({
  onAction,
  children,
  variant = "primary",
  className = "",
  loadingText,
  successText = "Done.",
  disabled,
  title,
}: ActionButtonProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  // The button may unmount before the action settles (e.g. a delete that
  // clears the selection), so guard the trailing setState.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function handle() {
    if (loading) return;
    setLoading(true);
    try {
      const result = await onAction();
      toast.success(typeof result === "string" ? result : successText);
    } catch (e) {
      if (!(e instanceof SkipError)) toast.error(formatError(e));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className={`${VARIANT_CLASS[variant]} ${className}`}
      onClick={handle}
      disabled={disabled || loading}
      title={title}
      aria-busy={loading}
    >
      {loading && <Spinner />}
      <span>{loading ? (loadingText ?? children) : children}</span>
    </button>
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

function formatError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.replace(/^Error:\s*/, "");
}
