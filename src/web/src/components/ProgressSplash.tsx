import { Link } from "react-router-dom";
import { useStatus } from "./StatusProvider";

type StepState = "pending" | "running" | "done" | "failed";

function StepRow({
  state,
  label,
  detail,
}: {
  state: StepState;
  label: string;
  detail?: React.ReactNode;
}) {
  const icon = {
    pending: <span className="font-display italic text-faint">○</span>,
    running: (
      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-brass border-t-transparent" />
    ),
    done: <span className="text-sage">✓</span>,
    failed: <span className="text-brick">✗</span>,
  }[state];

  return (
    <li className="flex items-start gap-3 py-3">
      <span className="mt-0.5 flex h-4 w-4 items-center justify-center">
        {icon}
      </span>
      <div className="flex-1">
        <div
          className={`text-sm ${
            state === "done"
              ? "text-muted"
              : state === "failed"
                ? "text-brick"
                : state === "running"
                  ? "text-ink"
                  : "text-faint"
          }`}
        >
          {label}
        </div>
        {detail && (
          <div className="mt-1.5 text-xs text-muted">{detail}</div>
        )}
      </div>
    </li>
  );
}

export function ProgressSplash() {
  const { fast, error, refresh } = useStatus();

  const installed = fast?.claude.installed ?? null;
  const versionKnown = !!fast?.claude.version;

  const detectState: StepState =
    installed === null ? "running" : installed ? "done" : "failed";

  const versionState: StepState =
    installed === false
      ? "pending"
      : installed === null
        ? "pending"
        : versionKnown
          ? "done"
          : "running";

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-6">
      <div className="w-full max-w-md animate-page-in">
        <div className="relative">
          <div
            aria-hidden
            className="compass-rose pointer-events-none absolute -top-20 left-1/2 h-40 w-40 -translate-x-1/2 opacity-50"
          />
          <div className="card relative">
            <header className="mb-4 text-center">
              <div className="eyebrow">An Atlas for Claude Code</div>
              <h1 className="font-display text-4xl text-ink">
                Compass
              </h1>
              <div className="font-display italic text-muted">
                charting a course…
              </div>
            </header>

            <div className="rule-dotted my-4" />

            <ul className="divide-y divide-rule">
              <StepRow
                state={detectState}
                label="Detecting Claude CLI"
                detail={
                  installed === false ? (
                    <div className="space-y-3">
                      <div>Not found in PATH. Install with:</div>
                      <pre className="code-block text-[11px]">
                        npm i -g @anthropic-ai/claude-code
                      </pre>
                      <button
                        className="btn-ghost"
                        onClick={() => refresh()}
                      >
                        Retry
                      </button>
                    </div>
                  ) : installed ? (
                    fast?.claude.path && (
                      <span className="font-mono">{fast.claude.path}</span>
                    )
                  ) : null
                }
              />
              <StepRow
                state={versionState}
                label="Reading version"
                detail={fast?.claude.version ?? undefined}
              />
            </ul>

            {error && (
              <div className="mt-4 rounded-md border border-brick/40 bg-brick/10 p-3 text-xs text-brick">
                {error}
                <button
                  className="ml-2 underline hover:no-underline"
                  onClick={() => refresh()}
                >
                  Retry
                </button>
              </div>
            )}

            <Link
              to="/setup"
              className="mt-4 block text-center font-display italic text-sm text-brass hover:underline"
            >
              Trouble? Go to Setup →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
