// Takes the figures out of the question files, where they sit as base64 PNGs (84% of the
// bank's size), and writes each to public/qimg/ as an optimised PNG plus whichever of AVIF
// and WebP come out smaller. The question then points at the file instead, so a figure is
// only downloaded when its question is shown, and in the best format the browser supports.
//
// The file name says which smaller formats exist, best first: qimg/<hash>-aw.png has an AVIF
// and a WebP beside it; src/components/ui/QuestionImage.tsx reads it back. Run once after
// adding questions with embedded figures:  node scripts/compress-question-images.mjs
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const FILES = ['public/question-bank.json', 'public/tests/october-2026.json'];
const OUT = 'public/qimg';
mkdirSync(OUT, { recursive: true });

const done = new Map();
const totals = { before: 0, png: 0, best: 0 };

async function convert(dataUri) {
  if (done.has(dataUri)) return done.get(dataUri);
  const input = Buffer.from(dataUri.slice(dataUri.indexOf(',') + 1), 'base64');
  const hash = createHash('sha256').update(input).digest('hex').slice(0, 16);

  // Figures are line art and tables: lossless keeps every thin line and digit crisp.
  const png = await sharp(input).png({ compressionLevel: 9, palette: true, quality: 100, effort: 10 }).toBuffer();
  const pngOut = png.length < input.length ? png : input;
  const webp = await sharp(input).webp({ lossless: true, effort: 6 }).toBuffer();
  // Near-lossless AVIF: visually identical on diagrams, usually the smallest of the three.
  const avif = await sharp(input).avif({ quality: 80, effort: 9, chromaSubsampling: '4:4:4' }).toBuffer();

  const smaller = [
    { tag: 'a', ext: 'avif', buf: avif },
    { tag: 'w', ext: 'webp', buf: webp },
  ]
    .filter((v) => v.buf.length < pngOut.length * 0.95)
    .sort((x, y) => x.buf.length - y.buf.length);

  const tags = smaller.map((v) => v.tag).join('');
  const base = `${hash}${tags ? `-${tags}` : ''}`;
  writeFileSync(`${OUT}/${base}.png`, pngOut);
  for (const v of smaller) writeFileSync(`${OUT}/${base}.${v.ext}`, v.buf);

  totals.before += input.length;
  totals.png += pngOut.length;
  totals.best += smaller[0]?.buf.length ?? pngOut.length;
  const src = `qimg/${base}.png`;
  done.set(dataUri, src);
  return src;
}

for (const file of FILES) {
  if (!existsSync(file)) continue;
  const data = JSON.parse(readFileSync(file, 'utf8'));
  let n = 0;
  for (const q of data.questions) {
    for (const img of q.images ?? []) {
      if (img.src.startsWith('data:')) {
        img.src = await convert(img.src);
        n++;
      }
    }
    for (const c of q.choices ?? []) {
      if (c.image?.startsWith('data:')) {
        c.image = await convert(c.image);
        n++;
      }
    }
  }
  if (n === 0) continue;
  // A new revision makes every browser fetch the slimmer bank instead of keeping its copy.
  if (typeof data.revision === 'number') data.revision += 1;
  writeFileSync(file, JSON.stringify(data));
  console.log(`${file}: ${n} figures moved out`);
}

const kb = (b) => `${Math.round(b / 1024)} KB`;
console.log(
  `${done.size} images: ${kb(totals.before)} as PNG before, ${kb(totals.png)} optimised PNG, ${kb(totals.best)} in the best format`,
);
