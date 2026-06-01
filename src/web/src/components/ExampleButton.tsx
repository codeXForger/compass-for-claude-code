import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Sample } from "../lib/samples";

/**
 * A "Example" trigger (placed in PageHeader next to the Guide button) that opens
 * a right-side slide-over showing a fully filled-in, read-only sample of the
 * current resource — every field populated plus the resulting file/JSON.
 */
export function ExampleButton({ sample }: { sample: Sample }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Example: ${sample.title}`}
        title={`See a sample`}
        className="btn-quiet h-6 gap-1 px-2 text-[11px]"
      >
        <span aria-hidden className="text-sm leading-none">
          ▤
        </span>
        Example
      </button>

      {open &&
        createPortal(
          <>
            <button
              type="button"
              aria-label="Close example"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 cursor-default bg-ink/40 animate-fade-in"
            />
            <aside
              role="dialog"
              aria-modal="true"
              aria-labelledby={headingId}
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto border-l border-rule-strong bg-surface shadow-2xl animate-page-in"
            >
              {/* Header */}
              <div className="sticky top-0 z-10 border-b border-rule bg-surface/95 px-6 pb-4 pt-6 backdrop-blur">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2 text-faint">
                      <span aria-hidden className="text-sm">
                        ▤
                      </span>
                      <span className="eyebrow">Worked example</span>
                    </div>
                    <h2
                      id={headingId}
                      className="mt-1 font-display text-3xl leading-none text-ink"
                    >
                      {sample.title}
                    </h2>
                    <p className="mt-1 font-display text-sm italic text-muted">
                      {sample.blurb}
                    </p>
                  </div>
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close example"
                    className="btn-quiet h-7 w-7 shrink-0 justify-center px-0 text-base"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="space-y-6 px-6 py-6">
                {sample.usage && (
                  <div>
                    <div className="mb-1.5 eyebrow">How to run it</div>
                    <div className="rounded-r-md border-l-2 border-brass/60 bg-brass/5 px-3 py-2">
                      <div className="font-mono text-[12.5px] text-ink">
                        {sample.usage.value}
                      </div>
                      {sample.usage.note && (
                        <div className="mt-1 text-[11.5px] leading-relaxed text-muted">
                          {sample.usage.note}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <Section label="Fields">
                  <dl className="space-y-3">
                    {sample.fields.map((f, i) => (
                      <FieldRow key={i} field={f} />
                    ))}
                  </dl>
                </Section>

                {sample.body && (
                  <Section label={sample.body.label}>
                    <pre className="card-flat overflow-x-auto whitespace-pre-wrap px-3 py-2 font-mono text-[11.5px] leading-relaxed text-ink">
                      {sample.body.value}
                    </pre>
                  </Section>
                )}

                {sample.extras && sample.extras.length > 0 && (
                  <Section label="Bundled files">
                    <ul className="space-y-2">
                      {sample.extras.map((f, i) => (
                        <li
                          key={i}
                          className="rounded-md border border-rule bg-surface px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[12px] text-ink">
                              {f.label}
                            </span>
                            {f.value === "runnable" && (
                              <span className="pill-sage text-[10px]">
                                runnable
                              </span>
                            )}
                          </div>
                          {f.note && (
                            <div className="mt-0.5 text-[11.5px] text-faint">
                              {f.note}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                <Section label={sample.raw.label}>
                  <pre className="card-flat overflow-x-auto whitespace-pre px-3 py-2 font-mono text-[11.5px] leading-relaxed text-ink">
                    {sample.raw.value}
                  </pre>
                </Section>
              </div>
            </aside>
          </>,
          document.body,
        )}
    </>
  );
}

function FieldRow({ field }: { field: SampleFieldLike }) {
  return (
    <div>
      <dt className="eyebrow">{field.label}</dt>
      <dd className="mt-0.5 font-mono text-[12.5px] text-ink">{field.value}</dd>
      {field.note && (
        <dd className="mt-0.5 text-[11.5px] text-faint">{field.note}</dd>
      )}
    </div>
  );
}

interface SampleFieldLike {
  label: string;
  value: string;
  note?: string;
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 eyebrow">{label}</div>
      <div className="text-[12.5px] leading-relaxed text-muted">{children}</div>
    </div>
  );
}
