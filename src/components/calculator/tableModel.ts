import type { TableData } from '../../lib/calculator/types';

/** Columns per table: the x/y pair an SAT scatterplot question hands you. */
const COLUMN_COUNT = 2;
/** Blank rows a new table starts with — enough to type a small data set into. */
const INITIAL_ROWS = 5;

/** One row of the editor. Cells stay strings so a half-typed `-` or `.` survives a keystroke. */
export interface TableRowData {
  id: number;
  cells: string[];
}

/** A table as the editor holds it. `index` names its columns: 1 → `x_1`, `y_1`. */
export interface EditableTable {
  index: number;
  rows: TableRowData[];
}

let nextRowId = 0;

export function createRow(): TableRowData {
  nextRowId += 1;
  return { id: nextRowId, cells: Array.from({ length: COLUMN_COUNT }, () => '') };
}

export function createTable(index: number): EditableTable {
  return { index, rows: Array.from({ length: INITIAL_ROWS }, createRow) };
}

/** The names expressions reference, e.g. `y_1 ~ m*x_1 + b`. */
export function columnNames(index: number): string[] {
  return [`x_${index}`, `y_${index}`];
}

/** The engine's view of a table: a blank or unreadable cell is NaN, which drops that pair. */
export function toTableData(table: EditableTable): TableData {
  return {
    id: `table-${table.index}`,
    columns: columnNames(table.index).map((name, column) => ({
      name,
      values: table.rows.map((row) => parseCell(row.cells[column])),
    })),
  };
}

function parseCell(text: string): number {
  // Pasted data often carries a typographic minus, which `Number` refuses.
  const trimmed = text.trim().replace(/[−–—]/g, '-');
  return trimmed === '' ? Number.NaN : Number(trimmed);
}
