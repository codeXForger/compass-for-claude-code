import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { getGuide } from "../lib/guides";
import { getSample } from "../lib/samples";
import { GuideButton } from "./GuideButton";
import { ExampleButton } from "./ExampleButton";

interface Props {
  chapter?: string;
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}

/**
 * Chapter heading: chapter number, eyebrow, display-serif title,
 * italic subtitle, mono meta line, and right-aligned actions.
 */
export function PageHeader({
  chapter,
  eyebrow,
  title,
  subtitle,
  meta,
  actions,
}: Props) {
  const { pathname } = useLocation();
  const guide = getGuide(pathname);
  const sample = getSample(pathname);
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-baseline gap-3 text-faint">
            {chapter && <span className="chapter-num">{chapter}</span>}
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            {guide && <GuideButton guide={guide} />}
            {sample && <ExampleButton sample={sample} />}
          </div>
          <h1 className="display-title mt-1 text-balance">{title}</h1>
          {subtitle && (
            <div className="display-subtitle mt-0.5">{subtitle}</div>
          )}
          {meta && (
            <div className="mt-2 font-mono text-[11px] text-faint">{meta}</div>
          )}
        </div>
        {actions && (
          <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
      <div className="rule-tick" aria-hidden />
    </header>
  );
}
