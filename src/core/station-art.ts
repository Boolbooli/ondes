import type { Line } from './types';

/**
 * Authored artwork: each station is an enamel métro plaque — porcelain keyline, the line's
 * roundel, the name in condensed capitals and the line running underneath with a stop.
 * The same SVG is drawn inline in the app and rendered to PNG for the lock screen.
 */

export const ENAMEL = '#0B1230';
export const PORCELAIN = '#F6F3EC';
export const ART_FONT = "'Archivo Variable', Archivo, 'Arial Narrow', sans-serif";

const SIZE = 512;
const AXIS_X = 88;
const ROUNDEL_Y = 104;
const ROUNDEL_R = 44;
const NAME_LEFT = 56;
const NAME_WIDTH = 400;
const NAME_TOP = 176;
const NAME_BASELINE = 346;
const LINE_Y = 404;

const SIZES = [128, 112, 100, 88, 78, 70, 62, 56, 50, 44];

export function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] ?? c);
}

/** Rough advance of a capital at 75% width and weight 800, in em; runtime fitting corrects the rest. */
function advance(ch: string): number {
  if (ch === ' ') return 0.22;
  if (/[MWÆŒ]/.test(ch)) return 0.74;
  if (/[IÌÍÎÏ!|]/.test(ch)) return 0.25;
  if (/[.,:;’'\-–]/.test(ch)) return 0.26;
  if (/[0-9]/.test(ch)) return 0.5;
  return 0.53;
}

export const measureEm = (text: string): number => [...text].reduce((sum, ch) => sum + advance(ch), 0);

function wrap(words: readonly string[], maxEm: number, allowOverflow: boolean): string[] | undefined {
  const out: string[] = [];
  let line = '';
  for (const word of words) {
    if (!allowOverflow && measureEm(word) > maxEm) return undefined;
    const candidate = line ? `${line} ${word}` : word;
    if (line && measureEm(candidate) > maxEm) {
      out.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) out.push(line);
  return out;
}

export interface NameLayout {
  readonly size: number;
  readonly lineHeight: number;
  readonly lines: readonly string[];
}

/** The largest type size at which the name fits the plaque, in as few lines as it takes. */
export function layoutName(name: string): NameLayout {
  const words = name.toLocaleUpperCase('fr').split(/\s+/).filter(Boolean);
  const height = NAME_BASELINE - NAME_TOP;
  for (const size of SIZES) {
    const lineHeight = Math.round(size * 0.94);
    const maxLines = Math.floor((height - size * 0.72) / lineHeight) + 1;
    const lines = wrap(words, NAME_WIDTH / size, false);
    if (lines && lines.length <= maxLines) return { size, lineHeight, lines };
  }
  const size = SIZES[SIZES.length - 1] ?? 44;
  const lineHeight = Math.round(size * 0.94);
  const lines = wrap(words, NAME_WIDTH / size, true) ?? [name];
  const maxLines = Math.floor((height - size * 0.72) / lineHeight) + 1;
  const kept = lines.slice(0, maxLines);
  if (lines.length > maxLines) kept[maxLines - 1] = `${kept[maxLines - 1]}…`;
  return { size, lineHeight, lines: kept };
}

/** Line roundel as SVG: the favourites line draws a star, the others their label. */
export function roundelSvg(line: Line, cx: number, cy: number, r: number): string {
  const disc = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${line.ink}"/>`;
  if (line.id === 'fav') return disc + starPath(cx, cy, r * 0.58, line.onInk);
  return (
    disc +
    `<text x="${cx}" y="${cy}" dy="0.355em" text-anchor="middle" fill="${line.onInk}" ` +
    `style="font-family:${ART_FONT};font-weight:750;font-stretch:87.5%;font-size:${Math.round(r * 1.18)}px">` +
    `${escapeXml(line.roundel)}</text>`
  );
}

/** A five-pointed star centred on (cx, cy). */
export function starPath(cx: number, cy: number, r: number, fill: string): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle) + r * 0.06).toFixed(2)}`);
  }
  return `<polygon points="${points.join(' ')}" fill="${fill}" stroke="${fill}" stroke-width="${(r * 0.12).toFixed(2)}" stroke-linejoin="round"/>`;
}

/** The station plaque, 512 × 512. Text marked `data-fit` is squeezed at runtime if a name runs long. */
export function stationArtSvg(name: string, line: Line): string {
  const layout = layoutName(name);
  const first = NAME_BASELINE - (layout.lines.length - 1) * layout.lineHeight;
  const text = layout.lines
    .map(
      (row, i) =>
        `<text x="${NAME_LEFT}" y="${first + i * layout.lineHeight}" data-fit="${NAME_WIDTH}" fill="${PORCELAIN}" ` +
        `style="font-family:${ART_FONT};font-weight:800;font-stretch:75%;font-size:${layout.size}px">${escapeXml(row)}</text>`,
    )
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" aria-hidden="true" focusable="false">` +
    `<rect width="${SIZE}" height="${SIZE}" fill="${ENAMEL}"/>` +
    `<path d="M20 ${LINE_Y}H492" stroke="${line.ink}" stroke-width="28"/>` +
    `<circle cx="${AXIS_X}" cy="${LINE_Y}" r="22" fill="${PORCELAIN}" stroke="${ENAMEL}" stroke-width="7"/>` +
    `<rect x="20" y="20" width="472" height="472" rx="28" fill="none" stroke="${PORCELAIN}" stroke-width="4"/>` +
    roundelSvg(line, AXIS_X, ROUNDEL_Y, ROUNDEL_R) +
    text +
    `</svg>`
  );
}

/**
 * Squeezes plaque text that overflows its box once real fonts are in place. Self-contained so the
 * artwork script can run it inside the page it screenshots.
 */
export function fitArtText(root: ParentNode): void {
  for (const node of Array.from(root.querySelectorAll('text[data-fit]'))) {
    const text = node as SVGTextElement;
    const max = Number(text.getAttribute('data-fit'));
    text.removeAttribute('textLength');
    text.removeAttribute('lengthAdjust');
    if (max > 0 && text.getComputedTextLength() > max) {
      text.setAttribute('textLength', String(max));
      text.setAttribute('lengthAdjust', 'spacingAndGlyphs');
    }
  }
}

const NETWORK = { scarlet: '#D93A2B', cobalt: '#2F64D6', amber: '#F2B01E' } as const;

/** The interchange mark: three lines meeting in concentric rings, the "ondes". */
function interchange(cx: number, cy: number, scale: number, bleed: number): string {
  const w = 64 * scale;
  const ring = 92 * scale;
  return (
    `<path d="M${-bleed} ${cy}H${cx}" stroke="${NETWORK.scarlet}" stroke-width="${w}"/>` +
    `<path d="M${cx} ${SIZE + bleed}V${cy}" stroke="${NETWORK.cobalt}" stroke-width="${w}"/>` +
    `<path d="M${SIZE + bleed} ${-bleed}L${cx} ${cy}" stroke="${NETWORK.amber}" stroke-width="${w}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${ring + 30 * scale}" fill="${ENAMEL}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${ring}" fill="none" stroke="${PORCELAIN}" stroke-width="${30 * scale}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${32 * scale}" fill="${PORCELAIN}"/>`
  );
}

/** Home-screen icon, full-bleed square (iOS rounds the corners; maskable-safe). */
export function appIconSvg(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">` +
    `<rect width="${SIZE}" height="${SIZE}" fill="${ENAMEL}"/>` +
    interchange(256, 256, 1, 40) +
    `</svg>`
  );
}

/** Browser tab icon: the same mark on a rounded tile, heavier for small sizes. */
export function faviconSvg(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">` +
    `<defs><clipPath id="c"><rect width="${SIZE}" height="${SIZE}" rx="112"/></clipPath></defs>` +
    `<g clip-path="url(#c)"><rect width="${SIZE}" height="${SIZE}" fill="${ENAMEL}"/>` +
    interchange(256, 256, 1.3, 40) +
    `</g></svg>`
  );
}

/** Launch image: the mark and the wordmark centred on enamel. */
export function splashSvg(width: number, height: number): string {
  const mark = Math.min(width, height) * 0.36;
  const scale = mark / SIZE;
  const x = (width - mark) / 2;
  const y = height / 2 - mark * 0.62;
  const font = Math.round(mark * 0.3);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">` +
    `<rect width="${width}" height="${height}" fill="${ENAMEL}"/>` +
    `<defs><clipPath id="m"><rect width="${SIZE}" height="${SIZE}" rx="114"/></clipPath></defs>` +
    `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(4)})"><g clip-path="url(#m)">` +
    `<rect width="${SIZE}" height="${SIZE}" fill="${ENAMEL}"/>${interchange(256, 256, 1, 40)}</g>` +
    `<rect x="2" y="2" width="${SIZE - 4}" height="${SIZE - 4}" rx="112" fill="none" stroke="${PORCELAIN}" stroke-opacity="0.18" stroke-width="4"/></g>` +
    `<text x="${width / 2}" y="${(y + mark + font * 1.6).toFixed(1)}" text-anchor="middle" fill="${PORCELAIN}" ` +
    `style="font-family:${ART_FONT};font-weight:800;font-stretch:75%;font-size:${font}px;letter-spacing:0.06em">ONDES</text>` +
    `</svg>`
  );
}
