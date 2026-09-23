import { Fragment, useMemo, type ReactNode } from 'react';
import { parseTex, type MathNode } from '../../lib/math/parseTex';

interface MathInlineProps {
  tex: string;
  /**
   * How many characters of the source string this equation stands for, delimiters
   * included. The highlighter counts the equation as one block of this length, because the
   * text a drawn fraction or root leaves in the page has nothing to do with its source.
   */
  sourceLength?: number;
}

/** Relations and binary operators get breathing room, as in typeset maths. */
const RELATIONS = new Set(['=', '<', '>', '≤', '≥', '≠', '≈']);
const BINARY = new Set(['+', '-', '−', '×', '÷', '±', '⋅']);
/** After one of these, a + or − is a sign, not an operation: `(−3)`, `= −6x`. */
const OPENS_OPERAND = new Set(['', '(', '[', '{', ',', ...RELATIONS, ...BINARY]);

/**
 * One equation, drawn as maths: stacked fractions, radicals, raised exponents. Rendered
 * without a TeX library — the converter only emits a handful of constructs, and the whole
 * renderer is smaller than one of a library's fonts.
 */
export function MathInline({ tex, sourceLength }: MathInlineProps) {
  const nodes = useMemo(() => parseTex(tex), [tex]);
  return (
    <span className="math" role="math" aria-label={speak(nodes)} data-math-len={sourceLength}>
      <span aria-hidden="true">{renderNodes(nodes, 'm')}</span>
    </span>
  );
}

function renderNodes(nodes: MathNode[], key: string): ReactNode[] {
  let previous = '';
  return nodes.map((node, index) => {
    const k = `${key}.${index}`;
    switch (node.kind) {
      case 'text': {
        const rendered = renderText(node.value, node.upright, k, previous);
        previous = lastVisible(node.value) || previous;
        return <Fragment key={k}>{rendered}</Fragment>;
      }
      case 'frac':
        previous = 'x';
        return (
          <span key={k} className="math-frac">
            <span className="math-frac-num">{renderNodes(node.num, `${k}n`)}</span>
            <span className="math-frac-den">{renderNodes(node.den, `${k}d`)}</span>
          </span>
        );
      case 'sqrt':
        previous = 'x';
        return (
          <span key={k} className="math-sqrt">
            {node.index && <span className="math-root-index">{renderNodes(node.index, `${k}i`)}</span>}
            <span className="math-radical">{'√'}</span>
            <span className="math-radicand">{renderNodes(node.body, `${k}b`)}</span>
          </span>
        );
      case 'sup':
        return (
          <span key={k} className="math-sup">
            {renderNodes(node.body, `${k}s`)}
          </span>
        );
      case 'sub':
        return (
          <span key={k} className="math-sub">
            {renderNodes(node.body, `${k}s`)}
          </span>
        );
      case 'overline':
        previous = 'x';
        return (
          <span key={k} className="math-overline">
            {renderNodes(node.body, `${k}o`)}
          </span>
        );
      case 'rows':
        previous = 'x';
        return (
          <span key={k} className="math-rows" style={{ gridTemplateColumns: `repeat(${columnsOf(node.rows)}, auto)` }}>
            {node.rows.flatMap((row, r) =>
              Array.from({ length: columnsOf(node.rows) }, (_, c) => (
                // The cell before an `&` is right-aligned so the equals signs line up; with
                // no alignment point there is one column, and it reads best from the left.
                <span
                  key={`${k}r${r}c${c}`}
                  className={c === 0 && columnsOf(node.rows) > 1 ? 'math-cell-first' : 'math-cell'}
                >
                  {row[c] ? renderNodes(row[c], `${k}r${r}c${c}`) : null}
                </span>
              )),
            )}
          </span>
        );
    }
  });
}

function columnsOf(rows: MathNode[][][]): number {
  return Math.max(1, ...rows.map((row) => row.length));
}

function lastVisible(value: string): string {
  const trimmed = value.trimEnd();
  return trimmed ? trimmed[trimmed.length - 1] : '';
}

/**
 * Plain characters inside an equation. Single Latin letters are variables and go italic;
 * digits, operators and words written upright by the converter stay upright. A hyphen is
 * shown as a true minus sign, which is the character a typeset equation uses.
 */
function renderText(value: string, upright: boolean, key: string, before: string): ReactNode[] {
  const out: ReactNode[] = [];
  let run = '';
  let runItalic = false;
  let previous = before;
  const flush = () => {
    if (!run) return;
    out.push(
      runItalic ? (
        <i key={`${key}-${out.length}`} className="math-var">
          {run}
        </i>
      ) : (
        run
      ),
    );
    run = '';
  };

  for (const raw of value) {
    const ch = raw === '-' ? '−' : raw;
    const isOperator = RELATIONS.has(ch) || (BINARY.has(ch) && !OPENS_OPERAND.has(previous));
    if (isOperator) {
      flush();
      out.push(
        <span key={`${key}-${out.length}`} className="math-op">
          {ch}
        </span>,
      );
    } else {
      const italic = !upright && /[a-zA-Z]/.test(ch);
      if (italic !== runItalic) flush();
      runItalic = italic;
      run += ch;
    }
    if (ch.trim()) previous = ch;
  }
  flush();
  return out;
}

/** What a screen reader hears, since the drawn fraction reads as run-together digits. */
function speak(nodes: MathNode[]): string {
  return nodes
    .map((node): string => {
      switch (node.kind) {
        case 'text':
          return node.value.replace(/-/g, ' minus ');
        case 'frac':
          return ` ${speak(node.num)} over ${speak(node.den)} `;
        case 'sqrt':
          return node.index
            ? ` root ${speak(node.index)} of ${speak(node.body)} `
            : ` square root of ${speak(node.body)} `;
        case 'sup':
          return ` to the power ${speak(node.body)} `;
        case 'sub':
          return ` sub ${speak(node.body)} `;
        case 'overline':
          return ` segment ${speak(node.body)} `;
        case 'rows':
          return node.rows.map((row) => row.map(speak).join(' ')).join('; ');
      }
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}
