/**
 * A single aligned row of a line-level diff. Equal lines have both `left` and
 * `right` set (and `changed` false); a removed line has `right === null`, an
 * added line has `left === null` — both with `changed` true.
 */
export interface DiffRow {
  left: string | null;
  right: string | null;
  changed: boolean;
}

/**
 * Minimal dependency-free line diff (LCS), enough to render a before/after
 * side-by-side view. Splits on newlines, finds the longest common subsequence
 * of lines, then walks both sides into aligned rows. Not optimized for huge
 * inputs, but CLAUDE.md files are small.
 */
export function diffLines(before: string, after: string): DiffRow[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const n = a.length;
  const m = b.length;

  // lcs[i][j] = length of LCS of a[i..] and b[j..].
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ left: a[i], right: b[j], changed: false });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      rows.push({ left: a[i], right: null, changed: true });
      i++;
    } else {
      rows.push({ left: null, right: b[j], changed: true });
      j++;
    }
  }
  while (i < n) rows.push({ left: a[i++], right: null, changed: true });
  while (j < m) rows.push({ left: null, right: b[j++], changed: true });

  return rows;
}
