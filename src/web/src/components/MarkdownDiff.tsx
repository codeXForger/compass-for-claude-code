import { diffLines } from "../lib/linediff";

interface Props {
  /** Original text (left column). */
  before: string;
  /** Proposed reformatted text (right column). */
  after: string;
  /** Accept the `after` text. */
  onApply: () => void;
  /** Reject and keep `before`. */
  onDiscard: () => void;
}

/**
 * Side-by-side line diff of the editor's text vs. Claude's reformatted Markdown,
 * with Apply / Discard. Removed lines tint amber on the left, added lines tint
 * sage on the right; unchanged lines stay quiet so real edits stand out.
 */
export function MarkdownDiff({ before, after, onApply, onDiscard }: Props) {
  const rows = diffLines(before, after);

  return (
    <div className="space-y-3">
      <div className="card overflow-hidden p-0">
        <div className="grid grid-cols-2 divide-x divide-rule">
          <Column label="Before" side="left" rows={rows} />
          <Column label="After" side="right" rows={rows} />
        </div>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary" onClick={onApply}>
          Apply
        </button>
        <button className="btn-ghost" onClick={onDiscard}>
          Discard
        </button>
      </div>
    </div>
  );
}

function Column({
  label,
  side,
  rows,
}: {
  label: string;
  side: "left" | "right";
  rows: ReturnType<typeof diffLines>;
}) {
  return (
    <div className="min-w-0">
      <div className="border-b border-rule bg-sunken px-3 py-1.5 eyebrow">
        {label}
      </div>
      <div className="max-h-[60vh] overflow-auto">
        {rows.map((r, i) => {
          const text = side === "left" ? r.left : r.right;
          const present = text !== null;
          const tint = r.changed
            ? present
              ? side === "left"
                ? "bg-ember/10"
                : "bg-sage/10"
              : "bg-rule/30"
            : "";
          return (
            <pre
              key={i}
              className={`whitespace-pre-wrap break-words px-3 font-mono text-[12px] leading-relaxed text-ink ${tint}`}
            >
              {present ? text || " " : " "}
            </pre>
          );
        })}
      </div>
    </div>
  );
}
