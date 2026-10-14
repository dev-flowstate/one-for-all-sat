import type { ImgHTMLAttributes } from 'react';

const SHIPPED = /^qimg\/(.+?)(?:-([aw]+))?\.png$/;
const FORMATS = { a: ['avif', 'image/avif'], w: ['webp', 'image/webp'] } as const;

/**
 * A question's figure. Figures shipped with the app (qimg/…) come in up to three formats, named
 * in the file: qimg/<hash>-aw.png has an AVIF and a WebP beside it, smallest first. The browser
 * takes the first type it can show, so a new phone gets the AVIF, most others the WebP, and an
 * old browser the PNG. Anything else (an imported bank's data: URL) is shown as it is.
 */
export function QuestionImage({ src, loading = 'lazy', ...rest }: ImgHTMLAttributes<HTMLImageElement> & { src: string }) {
  const match = SHIPPED.exec(src);
  if (!match) return <img src={src} loading={loading} decoding="async" {...rest} />;

  const base = `${import.meta.env.BASE_URL}qimg/${match[1]}${match[2] ? `-${match[2]}` : ''}`;
  return (
    // `contents`: the <img> stays the element the surrounding layout styles and sizes.
    <picture className="contents">
      {[...(match[2] ?? '')].map((tag) => {
        const [ext, type] = FORMATS[tag as keyof typeof FORMATS];
        return <source key={ext} srcSet={`${base}.${ext}`} type={type} />;
      })}
      <img src={`${base}.png`} loading={loading} decoding="async" {...rest} />
    </picture>
  );
}
