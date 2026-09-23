/**
 * Splits question text into prose, equations and tables.
 *
 * The question converter wraps every equation as `\( … \)` and writes every table as
 * `\[table:<JSON rows>\]`, its cells holding their own `\( … \)` maths. Neither delimiter
 * ever occurs in prose, so a question with no markup in it — every English question, and
 * the whole shipped bank — passes through as a single text segment, unchanged.
 */
export interface TextSegment {
  kind: 'text';
  /** Offsets into the full source string, delimiters included for the other kinds. */
  start: number;
  end: number;
  value: string;
}

export interface MathSegment {
  kind: 'math';
  start: number;
  end: number;
  /** The TeX between the delimiters. */
  tex: string;
}

export interface TableSegment {
  kind: 'table';
  start: number;
  end: number;
  /** Row by row; each cell is question text in its own right and may hold maths. */
  rows: string[][];
}

export type Segment = TextSegment | MathSegment | TableSegment;

const MATH_OPEN = '\\(';
const MATH_CLOSE = '\\)';
const TABLE_OPEN = '\\[table:';
const TABLE_CLOSE = '\\]';

export function hasMarkup(text: string): boolean {
  return text.includes(MATH_OPEN) || text.includes(TABLE_OPEN);
}

function parseRows(json: string): string[][] | null {
  try {
    const rows: unknown = JSON.parse(json);
    if (Array.isArray(rows) && rows.every((r) => Array.isArray(r) && r.every((c) => typeof c === 'string'))) {
      return rows as string[][];
    }
  } catch {
    // Falls through to being shown as text.
  }
  return null;
}

export function splitSegments(text: string): Segment[] {
  const out: Segment[] = [];
  let cursor = 0;
  const pushText = (end: number) => {
    if (end > cursor) out.push({ kind: 'text', start: cursor, end, value: text.slice(cursor, end) });
  };

  while (cursor < text.length) {
    const math = text.indexOf(MATH_OPEN, cursor);
    const table = text.indexOf(TABLE_OPEN, cursor);
    // Whichever comes first. A table is searched for as a whole before its cells' maths,
    // so the `\(` inside a cell is never taken for an equation in the surrounding text.
    const isTable = table !== -1 && (math === -1 || table < math);
    const open = isTable ? table : math;
    if (open === -1) break;

    const bodyStart = open + (isTable ? TABLE_OPEN : MATH_OPEN).length;
    const close = text.indexOf(isTable ? TABLE_CLOSE : MATH_CLOSE, bodyStart);
    // Unclosed: show the rest as the literal text it is rather than swallowing the question.
    if (close === -1) break;
    const end = close + (isTable ? TABLE_CLOSE : MATH_CLOSE).length;

    if (isTable) {
      const rows = parseRows(text.slice(bodyStart, close));
      if (!rows) {
        // Malformed: leave it as text and carry on after it.
        pushText(end);
        cursor = end;
        continue;
      }
      pushText(open);
      out.push({ kind: 'table', start: open, end, rows });
    } else {
      pushText(open);
      out.push({ kind: 'math', start: open, end, tex: text.slice(bodyStart, close) });
    }
    cursor = end;
  }
  pushText(text.length);
  return out;
}
