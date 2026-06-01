import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Guide } from "../lib/guides";

/**
 * A small "?" trigger (placed in PageHeader) that opens a right-side slide-over
 * drawer explaining the current page: what it is, why, how to use it, what it
 * impacts, and — importantly — how NOT to use it.
 */
export function GuideButton({ guide }: { guide: Guide }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();

  // Esc to close + lock body scroll + focus management, all gated on `open`.
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
        aria-label={`Guide: ${guide.title}`}
        title={`What is ${guide.title}?`}
        className="btn-quiet h-6 gap-1 px-2 text-[11px]"
      >
        <span aria-hidden className="font-display text-sm italic leading-none">
          ?
        </span>
        Guide
      </button>

      {open &&
        createPortal(
          <>
            <button
              type="button"
              aria-label="Close guide"
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
                      <span className="chapter-num text-lg">?</span>
                      <span className="eyebrow">Field guide</span>
                    </div>
                    <h2
                      id={headingId}
                      className="mt-1 font-display text-3xl leading-none text-ink"
                    >
                      {guide.title}
                    </h2>
                    <p className="mt-1 font-display text-sm italic text-muted">
                      {guide.tagline}
                    </p>
                  </div>
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close guide"
                    className="btn-quiet h-7 w-7 shrink-0 justify-center px-0 text-base"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="space-y-6 px-6 py-6">
                <Section label="What it is">
                  <p>{guide.what}</p>
                </Section>

                <Section label="Why · purpose">
                  <p>{guide.why}</p>
                </Section>

                <Section label="How to use">
                  <ul className="space-y-1.5">
                    {guide.howToUse.map((s, i) => (
                      <li key={i} className="flex gap-2">
                        <span aria-hidden className="mt-px text-brass">
                          ·
                        </span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </Section>

                <Section label="Impact">
                  <p>{guide.impact}</p>
                </Section>

                {/* How NOT to use — warning block */}
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="pill-brick text-[10px]">
                      <span className="dot bg-brick" /> Do not
                    </span>
                    <span className="eyebrow">How not to use</span>
                  </div>
                  <ul className="space-y-2">
                    {guide.howNotToUse.map((s, i) => (
                      <li
                        key={i}
                        className="rounded-r-md border-l-2 border-brick/50 bg-brick/5 px-3 py-2 text-[12.5px] leading-relaxed text-ink"
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>

                {guide.extra && <div className="pt-1">{guide.extra}</div>}
              </div>
            </aside>
          </>,
          document.body,
        )}
    </>
  );
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
