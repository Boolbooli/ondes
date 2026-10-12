import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { countryName } from '../../src/core/i18n';
import { metaUrl } from '../../src/core/now-playing/poller';
import { looksLikePlaylist } from '../../src/core/playlist';
import { isHlsUrl } from '../../src/core/sources';
import { ENAMEL } from '../../src/core/station-art';
import type { LineId, Station } from '../../src/core/types';
import { inkStyle, isLineId, lineById, lines } from '../../src/data/lines';
import { catalog, defaultFavorites } from '../../src/data/stations';

// Node paths, not `new URL(…, import.meta.url)`: happy-dom's URL resolves against its page.
const ART_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'art');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WHITE = '#FFFFFF';

const ids = catalog.map((station) => station.id);

function byId(id: string): Station {
  const station = catalog.find((candidate) => candidate.id === id);
  if (!station) throw new Error(`No station ${id}`);
  return station;
}

const duplicates = <T>(values: readonly T[]): T[] => values.filter((value, i) => values.indexOf(value) !== i);

function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Width and height from the IHDR chunk, or null when the bytes are not a PNG. */
function pngSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (bytes.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** WCAG 2 relative luminance of a `#RRGGBB` colour. */
function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG 2 contrast ratio, from 1 to 21. */
function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe('stations', () => {
  it('have unique ids and names', () => {
    expect(catalog.length).toBeGreaterThan(0);
    expect(duplicates(ids)).toEqual([]);
    expect(duplicates(catalog.map((station) => station.name))).toEqual([]);
  });

  it('have ids that are safe as file names and cannot clash with custom stations', () => {
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(id).not.toMatch(/^(?:rb|url)-/);
    }
  });

  it('live on a line of the network, never on “Ma ligne” or “Mes stations”', () => {
    for (const station of catalog) {
      expect(isLineId(station.line), station.id).toBe(true);
      expect(['fav', 'perso'], station.id).not.toContain(station.line);
      expect(station.custom, station.id).toBeFalsy();
    }
  });

  it('leave no line of the network empty', () => {
    for (const line of lines.filter((candidate) => candidate.id !== 'fav' && candidate.id !== 'perso')) {
      expect(catalog.some((station) => station.line === line.id), line.id).toBe(true);
    }
  });

  it('have a tagline in French and in English', () => {
    for (const { id, tagline } of catalog) {
      for (const text of [tagline.fr, tagline.en]) {
        expect(text.trim(), id).not.toBe('');
        expect(text, id).toBe(text.trim());
      }
    }
  });

  it('name their country with an ISO 3166 code that has a name in both languages', () => {
    for (const { id, country } of catalog) {
      expect(country, id).toMatch(/^[A-Z]{2}$/);
      expect(countryName(country, 'fr'), id).not.toBe(country);
      expect(countryName(country, 'en'), id).not.toBe(country);
    }
  });

  it('link to their site over https', () => {
    for (const { id, site } of catalog) {
      if (site !== undefined) expect(isHttps(site), `${id}: ${site}`).toBe(true);
    }
  });
});

describe('streams', () => {
  it('give every station at least one stream, none listed twice', () => {
    for (const { id, streams } of catalog) {
      expect(streams.length, id).toBeGreaterThan(0);
      expect(duplicates(streams.map((stream) => stream.url)), id).toEqual([]);
    }
  });

  it('are https, with a kind, a codec, a bitrate and a quality', () => {
    for (const { id, streams } of catalog) {
      for (const { url, kind, codec, bitrate, quality } of streams) {
        expect(isHttps(url), `${id}: ${url}`).toBe(true);
        expect(['hls', 'icy'], `${id}: ${url}`).toContain(kind);
        expect(codec.trim(), `${id}: ${url}`).not.toBe('');
        expect(Number.isInteger(bitrate) && bitrate >= 0, `${id}: ${url}`).toBe(true);
        expect(['hifi', 'eco'], `${id}: ${url}`).toContain(quality);
      }
    }
  });

  it('are HLS exactly when the URL is an HLS playlist, and never an M3U or PLS playlist to resolve', () => {
    for (const { id, streams } of catalog) {
      for (const { url, kind } of streams) {
        expect(isHlsUrl(url), `${id}: ${url}`).toBe(kind === 'hls');
        expect(looksLikePlaylist(url), `${id}: ${url}`).toBe(false);
      }
    }
  });
});

describe('advertising', () => {
  it('is stated for every station', () => {
    for (const { id, ads } of catalog) expect(['none', 'onair', 'stream', 'unknown'], id).toContain(ads);
  });

  it('marks Europe 1 as inserting ads into its stream', () => {
    expect(byId('europe1').ads).toBe('stream');
  });

  it('keeps RTL to its broadcast HLS feed, since its Icecast stream inserts ads', () => {
    const rtl = byId('rtl');
    expect(rtl.ads).toBe('onair');
    expect(rtl.streams.map((stream) => stream.kind)).not.toContain('icy');
  });
});

describe('now-playing metadata', () => {
  it('covers every station streamed by Radio France, and only those', () => {
    for (const { id, streams, meta } of catalog) {
      const fromRadioFrance = streams.some((stream) => new URL(stream.url).hostname.endsWith('.radiofrance.fr'));
      expect(meta?.kind === 'radiofrance', id).toBe(fromRadioFrance);
    }
  });

  it('gives each Radio France station its own id and player rules', () => {
    const radioFrance = catalog.flatMap(({ meta }) => (meta?.kind === 'radiofrance' ? [meta] : []));
    expect(radioFrance.length).toBeGreaterThan(0);
    expect(duplicates(radioFrance.map((meta) => meta.id))).toEqual([]);
    for (const meta of radioFrance) {
      expect(Number.isInteger(meta.id) && meta.id > 0, String(meta.id)).toBe(true);
      expect(meta.rules).toMatch(/^transistor_[a-z_]+_player$/);
    }
  });

  it('asks SomaFM for the channel the station streams', () => {
    for (const { id, streams, meta } of catalog) {
      if (meta?.kind !== 'somafm') continue;
      expect(id).toBe(`soma-${meta.channel}`);
      expect(streams.every((stream) => new URL(stream.url).pathname.startsWith(`/${meta.channel}-`)), id).toBe(true);
    }
  });

  it('asks NTS for the matching channel', () => {
    expect(byId('nts1').meta).toEqual({ kind: 'nts', channel: '1' });
    expect(byId('nts2').meta).toEqual({ kind: 'nts', channel: '2' });
  });

  it('is fetched over https', () => {
    for (const { id, meta } of catalog) {
      if (meta) expect(isHttps(metaUrl(meta)), id).toBe(true);
    }
  });
});

describe('timeshift', () => {
  it('offers a positive window on an https HLS playlist', () => {
    const rewindable = catalog.filter((station) => station.timeshift);
    expect(rewindable.length).toBeGreaterThan(0);
    for (const { id, timeshift } of rewindable) {
      if (!timeshift) continue;
      expect(timeshift.window, id).toBeGreaterThan(0);
      expect(isHttps(timeshift.url), id).toBe(true);
      expect(isHlsUrl(timeshift.url), id).toBe(true);
    }
  });
});

describe('default favourites', () => {
  it('list existing stations, each once', () => {
    expect(defaultFavorites.length).toBeGreaterThan(0);
    expect(defaultFavorites.filter((id) => !ids.includes(id))).toEqual([]);
    expect(duplicates(defaultFavorites)).toEqual([]);
  });
});

describe('station art', () => {
  it('has a 512 × 512 PNG for every station', () => {
    for (const id of ids) {
      let bytes: Buffer | undefined;
      try {
        bytes = readFileSync(join(ART_DIR, `${id}.png`));
      } catch {
        bytes = undefined;
      }
      expect(bytes, `public/art/${id}.png is missing`).toBeDefined();
      if (bytes) expect(pngSize(bytes), id).toEqual({ width: 512, height: 512 });
    }
  });

  it('keeps no artwork for stations that left the catalogue', () => {
    const stale = readdirSync(ART_DIR)
      .filter((file) => file.endsWith('.png'))
      .map((file) => file.slice(0, -'.png'.length))
      .filter((id) => !ids.includes(id));
    expect(stale).toEqual([]);
  });
});

describe('lines', () => {
  it('have unique ids and roundels', () => {
    expect(duplicates(lines.map((line) => line.id))).toEqual([]);
    expect(duplicates(lines.map((line) => line.roundel))).toEqual([]);
  });

  it('have names in French and in English', () => {
    for (const { id, name } of lines) {
      expect(name.fr.trim(), id).not.toBe('');
      expect(name.en.trim(), id).not.toBe('');
    }
  });

  it('paint with #RRGGBB colours', () => {
    for (const { id, ink, onInk, inkLight } of lines) {
      for (const colour of [ink, onInk, inkLight ?? ink]) expect(colour, id).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  describe('contrast', () => {
    it('is measured as WCAG 2 defines it', () => {
      expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
      expect(contrast('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
      expect(contrast('#FFFFFF', '#777777')).toBe(contrast('#777777', '#FFFFFF'));
    });

    it('reaches 4.5:1 for the roundel text on its ink', () => {
      for (const { id, ink, onInk } of lines) {
        const ratio = contrast(onInk, ink);
        expect(ratio, `${id}: ${ratio.toFixed(3)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('reaches 3:1 for the line stroke on midnight enamel', () => {
      for (const { id, ink } of lines) {
        const ratio = contrast(ink, ENAMEL);
        expect(ratio, `${id}: ${ratio.toFixed(3)}:1`).toBeGreaterThanOrEqual(3);
      }
    });

    it('reaches 3:1 for the line stroke on white tile, through the light ink where there is one', () => {
      for (const { id, ink, inkLight } of lines) {
        const ratio = contrast(inkLight ?? ink, WHITE);
        expect(ratio, `${id}: ${ratio.toFixed(3)}:1`).toBeGreaterThanOrEqual(3);
      }
    });
  });

  it('are found by id, and an unknown id is an error', () => {
    expect(lineById('rf').name.en).toBe('Radio France');
    expect(() => lineById('metro' as LineId)).toThrow('Unknown line metro');
  });

  it('recognise only their own ids', () => {
    for (const { id } of lines) expect(isLineId(id)).toBe(true);
    for (const value of ['RF', '', 'toString', '__proto__', 1, null, undefined, { id: 'rf' }]) {
      expect(isLineId(value), String(value)).toBe(false);
    }
  });

  it('expose their inks as custom properties, the light ink falling back to the ink', () => {
    expect(inkStyle(lineById('info'))).toEqual({ '--ink': '#F2B01E', '--on-ink': '#1A1300', '--ink-light': '#A86E00' });
    expect(inkStyle(lineById('rf'))).toEqual({ '--ink': '#2F64D6', '--on-ink': '#FFFFFF', '--ink-light': '#2F64D6' });
  });
});
