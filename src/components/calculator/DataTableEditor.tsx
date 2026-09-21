import type { ClipboardEvent } from 'react';
import { columnNames, createRow } from './tableModel';
import type { EditableTable, TableRowData } from './tableModel';

interface DataTableEditorProps {
  table: EditableTable;
  /** Colour this table's points are drawn with on the graph. */
  color: string;
  onChange: (rows: TableRowData[]) => void;
  /** Absent while this is the only table, so the last one can't be deleted. */
  onRemove?: () => void;
}

const CELL_CLASS =
  'min-h-8 w-full rounded-md border border-rock-blue/50 bg-white px-1.5 py-1 text-right font-mono text-xs text-venice-blue-dark focus:border-venice-blue focus:outline-none';
const ICON_BUTTON_CLASS =
  'flex h-9 w-6 items-center justify-center rounded text-venice-blue-dark/60 hover:bg-rock-blue/20 hover:text-venice-blue-dark';

/**
 * Spreadsheet-style editor for one table of paired data. Pasting a block of tab- or
 * comma-separated values into any cell fills the grid from there, growing it as needed, because
 * that's how a student actually gets twenty points in — typing them is miserable.
 */
export function DataTableEditor({ table, color, onChange, onRemove }: DataTableEditorProps) {
  const names = columnNames(table.index);

  const setCell = (rowIndex: number, column: number, value: string) => {
    onChange(
      table.rows.map((row, index) =>
        index === rowIndex
          ? { ...row, cells: row.cells.map((cell, position) => (position === column ? value : cell)) }
          : row,
      ),
    );
  };

  const removeRow = (rowIndex: number) => {
    // Emptying the table entirely would leave nowhere to paste into, so keep one blank row.
    onChange(table.rows.length === 1 ? [createRow()] : table.rows.filter((_, index) => index !== rowIndex));
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>, rowIndex: number, column: number) => {
    const text = event.clipboardData.getData('text/plain');
    // A single value is just an ordinary paste; let the browser put it in the cell.
    if (!/[\t\r\n,]/.test(text)) return;
    event.preventDefault();
    onChange(pasteGrid(table.rows, parseGrid(text), rowIndex, column));
  };

  return (
    <div className="rounded-lg border border-rock-blue/40 p-1.5">
      <div className="flex items-center gap-2 px-0.5">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 rounded-sm"
          style={{ backgroundColor: color }}
        />
        <p className="flex-1 text-xs font-semibold text-venice-blue-dark">Table {table.index}</p>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove table ${table.index}`}
            className={ICON_BUTTON_CLASS}
          >
            ✕
          </button>
        )}
      </div>

      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            {names.map((name) => (
              <th
                key={name}
                scope="col"
                className="px-0.5 pb-1 text-right font-mono text-[11px] font-semibold text-venice-blue"
              >
                {name}
              </th>
            ))}
            <th className="w-6">
              <span className="sr-only">Remove row</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={row.id}>
              {names.map((name, column) => (
                <td key={name} className="px-0.5 pb-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={row.cells[column]}
                    onChange={(event) => setCell(rowIndex, column, event.target.value)}
                    onPaste={(event) => handlePaste(event, rowIndex, column)}
                    aria-label={`${name}, row ${rowIndex + 1}`}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className={CELL_CLASS}
                  />
                </td>
              ))}
              <td className="pb-1 align-middle">
                <button
                  type="button"
                  onClick={() => removeRow(rowIndex)}
                  aria-label={`Remove row ${rowIndex + 1} of table ${table.index}`}
                  className={ICON_BUTTON_CLASS}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        type="button"
        onClick={() => onChange([...table.rows, createRow()])}
        className="min-h-8 w-full rounded-md bg-rock-blue/20 text-xs font-semibold text-venice-blue-dark hover:bg-rock-blue/40"
      >
        + Row
      </button>
    </div>
  );
}

/**
 * Splits pasted text into a grid. Tabs (a spreadsheet selection) and commas (CSV) keep empty
 * cells where they are; anything else falls back to whitespace-separated columns.
 */
function parseGrid(text: string): string[][] {
  const grid = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map(splitCells);

  // A spreadsheet selection usually includes its header row; drop it when it holds no numbers.
  const header = grid[0];
  if (
    grid.length > 1 &&
    header.length > 0 &&
    header.every((cell) => cell.trim() !== '' && Number.isNaN(Number(cell.trim())))
  ) {
    grid.shift();
  }
  return grid;
}

function splitCells(line: string): string[] {
  if (line.includes('\t')) return line.split('\t');
  if (line.includes(',')) return line.split(',');
  return line.trim().split(/\s+/);
}

/** Writes a pasted grid in with its top-left corner at the cell that was pasted into. */
function pasteGrid(
  rows: readonly TableRowData[],
  grid: readonly string[][],
  rowIndex: number,
  column: number,
): TableRowData[] {
  const next = rows.map((row) => ({ ...row, cells: [...row.cells] }));
  grid.forEach((cells, rowOffset) => {
    const target = rowIndex + rowOffset;
    while (next.length <= target) next.push(createRow());
    cells.forEach((cell, columnOffset) => {
      const targetColumn = column + columnOffset;
      // Columns past the last one are dropped rather than inventing a third variable.
      if (targetColumn < next[target].cells.length) next[target].cells[targetColumn] = cell.trim();
    });
  });
  return next;
}
