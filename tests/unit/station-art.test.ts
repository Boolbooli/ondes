import { describe, expect, it, vi } from 'vitest';
import {
  appIconSvg,
  ENAMEL,
  escapeXml,
  faviconSvg,
  fitArtText,
  layoutName,
  measureEm,
  PORCELAIN,
  roundelSvg,
  splashSvg,
  starPath,
  stationArtSvg,
} from '../../src/core/station-art';
import type { Line } from '../../src/core/types';
import { lineById } from '../../src/data/lines';
import { catalog } from '../../src/data/stations';

const SVG_NS = 'http://www.w3.org/2000/svg';
const PLAQUE_TEXT_WIDTH = 400;

/** Parses SVG markup the way an image would be loaded. */
const parseSvg = (markup: string): Element => {
  const root = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
  expect(root.querySelector('parsererror')).toBeNull();
  return root;
};

/** Wraps an SVG fragment so it can be parsed on its own. */
const parseFragment = (fragment: string): Element => parseSvg(`<svg xmlns="${SVG_NS}">${fragment}</svg>`);

const attr = (element: Element | null | undefined, name: string): string | null => element?.getAttribute(name) ?? null;

/** Points of an SVG polygon, as numbers. */
const pointsOf = (polygon: Element | null): [number, number][] =>
  (attr(polygon, 'points') ?? '').split(' ').map((pair) => {
    const [x = NaN, y = NaN] = pair.split(',').map(Number);
    return [x, y];
  });

/** The words a name is set in on the plaque. */
const capitalWords = (name: string): string => name.toLocaleUpperCase('fr').split(/\s+/).filter(Boolean).join(' ');

const rf = lineById('rf');
const fav = lineById('fav');

describe('escapeXml', () => {
  it('escapes the five XML special characters', () => {
    expect(escapeXml(`<a href="x">Tom & Jerry's</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;');
  });

  it('leaves other text alone, and escapes existing entities again', () => {
    expect(escapeXml('Sacré français ! ★')).toBe('Sacré français ! ★');
    expect(escapeXml('&amp;')).toBe('&amp;amp;');
  });
});

describe('measureEm', () => {
  it.each<[string, number]>([
    ['', 0],
    [' ', 0.22],
    ['A', 0.53],
    ['É', 0.53],
    ['M', 0.74],
    ['Œ', 0.74],
    ['I', 0.25],
    ['!', 0.25],
    ['’', 0.26],
    ['-', 0.26],
    ['7', 0.5],
    ['FIP', 1.31],
    ['RADIO NOVA', 4.71],
  ])('gives %j an advance of %f em', (text, em) => {
    expect(measureEm(text)).toBeCloseTo(em, 10);
  });

  it('counts characters, not UTF-16 units', () => {
    expect(measureEm('𝄞')).toBeCloseTo(0.53, 10);
  });
});

describe('layoutName', () => {
  it('sets a short name on one line at the largest size', () => {
    expect(layoutName('FIP')).toEqual({ size: 128, lineHeight: 120, lines: ['FIP'] });
  });

  it('steps down until the name fits in as many lines as the plaque holds', () => {
    expect(layoutName('France Inter')).toEqual({ size: 100, lineHeight: 94, lines: ['FRANCE', 'INTER'] });
  });

  it('ignores extra spaces', () => {
    expect(layoutName('  Radio \t  Nova \n')).toEqual(layoutName('Radio Nova'));
  });

  it('keeps French accents in capitals', () => {
    expect(layoutName('Opéra').lines).toEqual(['OPÉRA']);
    expect(layoutName('FIP Sacré français !').lines.join(' ')).toBe('FIP SACRÉ FRANÇAIS !');
  });

  it('lets a single word too long for any size overflow at the smallest size, to be squeezed at runtime', () => {
    expect(layoutName('Supercalifragilisticexpialidocious')).toEqual({
      size: 44,
      lineHeight: 41,
      lines: ['SUPERCALIFRAGILISTICEXPIALIDOCIOUS'],
    });
  });

  it('cuts a name that cannot fit, with an ellipsis on the last line', () => {
    expect(layoutName('Radiodiffusion Internationale Francophone Communautaire Indépendante')).toEqual({
      size: 44,
      lineHeight: 41,
      lines: ['RADIODIFFUSION', 'INTERNATIONALE', 'FRANCOPHONE', 'COMMUNAUTAIRE…'],
    });
  });

  it.each(catalog.map((s) => [s.name]))('sets %s whole, within the plaque', (name) => {
    const layout = layoutName(name);
    expect(layout.lines.join(' ')).toBe(capitalWords(name));
    for (const row of layout.lines) expect(measureEm(row)).toBeLessThanOrEqual(PLAQUE_TEXT_WIDTH / layout.size);
  });
});

describe('roundelSvg', () => {
  it('draws the line’s disc with its label', () => {
    const svg = parseFragment(roundelSvg(rf, 88, 104, 44));
    const circle = svg.querySelector('circle');
    expect([attr(circle, 'cx'), attr(circle, 'cy'), attr(circle, 'r'), attr(circle, 'fill')]).toEqual(['88', '104', '44', rf.ink]);
    const label = svg.querySelector('text');
    expect(label?.textContent).toBe('1');
    expect(attr(label, 'fill')).toBe(rf.onInk);
    expect(attr(label, 'text-anchor')).toBe('middle');
    expect(attr(label, 'style')).toContain('font-size:52px');
    expect(svg.querySelector('polygon')).toBeNull();
  });

  it('draws a star for the favourites line instead of a label', () => {
    const svg = parseFragment(roundelSvg(fav, 50, 50, 40));
    expect(attr(svg.querySelector('circle'), 'fill')).toBe(fav.ink);
    expect(svg.querySelector('text')).toBeNull();
    const star = svg.querySelector('polygon');
    expect(attr(star, 'fill')).toBe(fav.onInk);
    expect(pointsOf(star)).toHaveLength(10);
  });

  it('escapes the label', () => {
    const odd: Line = { ...rf, roundel: '<&>' };
    expect(roundelSvg(odd, 0, 0, 10)).toContain('>&lt;&amp;&gt;</text>');
    expect(parseFragment(roundelSvg(odd, 0, 0, 10)).querySelector('text')?.textContent).toBe('<&>');
  });
});

describe('starPath', () => {
  const star = parseFragment(starPath(100, 100, 50, '#fff')).querySelector('polygon');

  it('alternates five tips and five notches around the centre, tip up', () => {
    const points = pointsOf(star);
    expect(points).toHaveLength(10);
    // The star sits a little low (6% of r) to look centred in its disc.
    const [cx, cy] = [100, 100 + 50 * 0.06];
    points.forEach(([x, y], i) => {
      expect(Math.hypot(x - cx, y - cy)).toBeCloseTo(i % 2 === 0 ? 50 : 22.5, 1);
    });
    expect(points[0]).toEqual([100, 53]);
  });

  it('is filled and outlined in one colour with round joins', () => {
    expect([attr(star, 'fill'), attr(star, 'stroke'), attr(star, 'stroke-width'), attr(star, 'stroke-linejoin')]).toEqual([
      '#fff',
      '#fff',
      '6.00',
      'round',
    ]);
  });
});

describe('stationArtSvg', () => {
  it('draws a 512 × 512 plaque on enamel, ruled with the line’s ink', () => {
    const svg = parseSvg(stationArtSvg('France Inter', rf));
    expect([attr(svg, 'viewBox'), attr(svg, 'width'), attr(svg, 'height')]).toEqual(['0 0 512 512', '512', '512']);
    expect(attr(svg.querySelector('rect'), 'fill')).toBe(ENAMEL);
    expect(attr(svg.querySelector('path'), 'stroke')).toBe(rf.ink);
    const roundel = svg.querySelector(`circle[fill="${rf.ink}"]`);
    expect([attr(roundel, 'cx'), attr(roundel, 'cy'), attr(roundel, 'r')]).toEqual(['88', '104', '44']);
  });

  it('sets the name in porcelain capitals, last line on the baseline, marked for fitting', () => {
    const rows = [...parseSvg(stationArtSvg('France Inter', rf)).querySelectorAll('text[data-fit]')];
    expect(rows.map((row) => row.textContent)).toEqual(['FRANCE', 'INTER']);
    expect(rows.map((row) => attr(row, 'y'))).toEqual(['252', '346']);
    for (const row of rows) {
      expect([attr(row, 'x'), attr(row, 'data-fit'), attr(row, 'fill')]).toEqual(['56', '400', PORCELAIN]);
      expect(attr(row, 'style')).toContain('font-size:100px');
    }
  });

  it('puts a one-line name on the baseline', () => {
    const rows = parseSvg(stationArtSvg('FIP', lineById('fip'))).querySelectorAll('text[data-fit]');
    expect([...rows].map((row) => [row.textContent, attr(row, 'y')])).toEqual([['FIP', '346']]);
  });

  it('escapes the name', () => {
    const markup = stationArtSvg('Rock & Roll <Live>', rf);
    expect(markup).not.toContain('<LIVE>');
    expect(markup).toContain('&amp;');
    const rows = parseSvg(markup).querySelectorAll('text[data-fit]');
    expect([...rows].map((row) => row.textContent).join(' ')).toBe('ROCK & ROLL <LIVE>');
  });
});

describe('fitArtText', () => {
  /** A plaque in a detached host, with the measured width of each name line faked. */
  function plaque(name: string, measure: (text: SVGTextElement) => number): { host: HTMLElement; rows: SVGTextElement[] } {
    const host = document.createElement('div');
    host.innerHTML = stationArtSvg(name, rf);
    const rows = [...host.querySelectorAll<SVGTextElement>('text[data-fit]')];
    for (const row of rows) vi.spyOn(row, 'getComputedTextLength').mockImplementation(() => measure(row));
    return { host, rows };
  }

  const squeeze = (row: SVGTextElement | undefined) => [row?.getAttribute('textLength'), row?.getAttribute('lengthAdjust')];

  it('squeezes a line wider than its box to the box', () => {
    const { host, rows } = plaque('Supercalifragilisticexpialidocious', () => 452);
    expect(rows).toHaveLength(1);
    fitArtText(host);
    expect(squeeze(rows[0])).toEqual(['400', 'spacingAndGlyphs']);
  });

  it('leaves lines that fit alone', () => {
    const { host, rows } = plaque('France Inter', () => 400);
    fitArtText(host);
    expect(rows.map(squeeze)).toEqual([
      [null, null],
      [null, null],
    ]);
  });

  it('measures the natural width, so fitting twice changes nothing and a line that now fits is released', () => {
    let natural = 452;
    const { host, rows } = plaque('Supercalifragilisticexpialidocious', (text) =>
      text.hasAttribute('textLength') ? 400 : natural,
    );
    fitArtText(host);
    fitArtText(host);
    expect(squeeze(rows[0])).toEqual(['400', 'spacingAndGlyphs']);

    natural = 380;
    fitArtText(host);
    expect(squeeze(rows[0])).toEqual([null, null]);
  });

  it('only touches text marked for fitting', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('textLength', '10');
    label.setAttribute('lengthAdjust', 'spacing');
    const unbounded = document.createElementNS(SVG_NS, 'text');
    unbounded.setAttribute('data-fit', '0');
    unbounded.setAttribute('textLength', '10');
    svg.append(label, unbounded);
    vi.spyOn(unbounded, 'getComputedTextLength').mockReturnValue(1_000);
    fitArtText(svg);
    expect(squeeze(label)).toEqual(['10', 'spacing']);
    expect(squeeze(unbounded)).toEqual([null, null]);
  });
});

describe('icons and launch images', () => {
  it('draws a full-bleed square home-screen icon, rounded by iOS', () => {
    const icon = parseSvg(appIconSvg());
    expect(attr(icon, 'viewBox')).toBe('0 0 512 512');
    expect(icon.querySelector('clipPath')).toBeNull();
    expect(attr(icon.querySelector('rect'), 'fill')).toBe(ENAMEL);
  });

  it('draws the favicon on a rounded tile', () => {
    const favicon = parseSvg(faviconSvg());
    expect(attr(favicon, 'viewBox')).toBe('0 0 512 512');
    expect(attr(favicon.querySelector('clipPath rect'), 'rx')).toBe('112');
  });

  it('centres the mark and the wordmark on a launch image of any size', () => {
    const portrait = parseSvg(splashSvg(1170, 2532));
    expect([attr(portrait, 'viewBox'), attr(portrait, 'width'), attr(portrait, 'height')]).toEqual(['0 0 1170 2532', '1170', '2532']);
    const word = portrait.querySelector('text');
    expect(word?.textContent).toBe('ONDES');
    expect([attr(word, 'x'), attr(word, 'text-anchor')]).toEqual(['585', 'middle']);
    expect(attr(word, 'style')).toContain('font-size:126px');
    // The mark is 36% of the short side: 421.2 px, centred horizontally.
    expect(attr(portrait.querySelector('g[transform]'), 'transform')).toBe('translate(374.4 1004.9) scale(0.8227)');

    const landscape = parseSvg(splashSvg(2532, 1170));
    expect(attr(landscape.querySelector('g[transform]'), 'transform')).toBe('translate(1055.4 323.9) scale(0.8227)');
  });
});
