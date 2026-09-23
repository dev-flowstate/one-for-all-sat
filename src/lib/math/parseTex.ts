/**
 * A parser for the small, fully-braced TeX subset the question converter emits:
 *
 *   \frac{a}{b}   \sqrt{x}   \sqrt[n]{x}   x^{2}   x_{1}   \overline{AB}   \mathrm{sin}
 *   rows separated by \\ and cells by &, for systems of equations
 *
 * It never throws. Anything it doesn't recognise comes back as literal text, so a
 * construct the converter starts emitting later shows up readable, if plain, rather than
 * breaking the question it's in.
 */
export type MathNode =
  | { kind: 'text'; value: string; upright: boolean }
  | { kind: 'frac'; num: MathNode[]; den: MathNode[] }
  | { kind: 'sqrt'; body: MathNode[]; index: MathNode[] | null }
  | { kind: 'sup'; body: MathNode[] }
  | { kind: 'sub'; body: MathNode[] }
  | { kind: 'overline'; body: MathNode[] }
  | { kind: 'rows'; rows: MathNode[][][] };

/** Escaped characters that stand for themselves. */
const LITERAL_ESCAPES: Record<string, string> = {
  '{': '{',
  '}': '}',
  '^': '^',
  _: '_',
  '&': '&',
  '%': '%',
  $: '$',
  '#': '#',
};

class Parser {
  private i = 0;
  private readonly src: string;
  private readonly upright: boolean;

  constructor(src: string, upright = false) {
    this.src = src;
    this.upright = upright;
  }

  /** Reads nodes until `stop` (or the end), leaving `i` on the stop character. */
  sequence(stop: '}' | ']' | null): MathNode[] {
    const out: MathNode[] = [];
    let text = '';
    const flush = () => {
      if (text) out.push({ kind: 'text', value: text, upright: this.upright });
      text = '';
    };

    while (this.i < this.src.length) {
      const ch = this.src[this.i];
      if (stop && ch === stop) break;

      if (ch === '\\') {
        const next = this.src[this.i + 1] ?? '';
        if (/[a-zA-Z]/.test(next)) {
          flush();
          out.push(...this.command());
          continue;
        }
        this.i += 2;
        if (next === ',') text += ' ';
        else if (next in LITERAL_ESCAPES) text += LITERAL_ESCAPES[next];
        else text += next;
        continue;
      }
      if (ch === '^' || ch === '_') {
        flush();
        this.i += 1;
        const body = this.argument();
        out.push(ch === '^' ? { kind: 'sup', body } : { kind: 'sub', body });
        continue;
      }
      if (ch === '{') {
        flush();
        this.i += 1;
        out.push(...this.sequence('}'));
        this.i += 1;
        continue;
      }
      text += ch;
      this.i += 1;
    }
    flush();
    return out;
  }

  /** A braced group, or a lone character: `x^2` is legal and means `x^{2}`. */
  private argument(): MathNode[] {
    if (this.src[this.i] === '{') {
      this.i += 1;
      const body = this.sequence('}');
      this.i += 1;
      return body;
    }
    const ch = this.src[this.i] ?? '';
    this.i += 1;
    return ch ? [{ kind: 'text', value: ch, upright: this.upright }] : [];
  }

  private command(): MathNode[] {
    const match = /^\\([a-zA-Z]+)/.exec(this.src.slice(this.i));
    const name = match ? match[1] : '';
    this.i += 1 + name.length;

    switch (name) {
      case 'frac': {
        const num = this.argument();
        const den = this.argument();
        return [{ kind: 'frac', num, den }];
      }
      case 'sqrt': {
        let index: MathNode[] | null = null;
        if (this.src[this.i] === '[') {
          this.i += 1;
          index = this.sequence(']');
          this.i += 1;
        }
        return [{ kind: 'sqrt', body: this.argument(), index }];
      }
      case 'overline':
        return [{ kind: 'overline', body: this.argument() }];
      case 'mathrm':
      case 'text': {
        // Words and units stay upright; only single-letter variables go italic.
        if (this.src[this.i] !== '{') return [];
        const close = matchingBrace(this.src, this.i);
        const inner = this.src.slice(this.i + 1, close);
        this.i = close + 1;
        return new Parser(inner, true).sequence(null);
      }
      case 'backslash':
        return [{ kind: 'text', value: '\\', upright: true }];
      default:
        return [{ kind: 'text', value: name, upright: true }];
    }
  }
}

function matchingBrace(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '\\') {
      i += 1;
      continue;
    }
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return src.length;
}

/** Splits on a delimiter at brace depth 0, skipping escapes, so `\frac{a\\b}{c}` stays whole. */
function splitTopLevel(src: string, delimiter: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < src.length; i++) {
    if (src.startsWith(delimiter, i) && depth === 0) {
      parts.push(src.slice(start, i));
      i += delimiter.length - 1;
      start = i + 1;
      continue;
    }
    if (src[i] === '\\') {
      i += 1;
      continue;
    }
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') depth = Math.max(0, depth - 1);
  }
  parts.push(src.slice(start));
  return parts;
}

export function parseTex(tex: string): MathNode[] {
  const rows = splitTopLevel(tex, '\\\\');
  if (rows.length === 1) return new Parser(tex).sequence(null);
  // A system of equations: one row per equation, cells aligned on the `&` the converter
  // puts before each equals sign.
  return [
    {
      kind: 'rows',
      rows: rows.map((row) => splitTopLevel(row, '&').map((cell) => new Parser(cell).sequence(null))),
    },
  ];
}
