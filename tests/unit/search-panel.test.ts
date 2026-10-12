import { describe, expect, it } from 'vitest';
import type { Lang, LineId, Station } from '../../src/core/types';
import { catalog } from '../../src/data/stations';
import { matchNetwork, toEntry } from '../../src/ui/SearchPanel';

const station = (name: string, line: LineId, tagline: string, fields: Partial<Station> = {}): Station => ({
  id: name.toLowerCase().replace(/\W+/g, '-'),
  name,
  line,
  country: '',
  tagline: { fr: tagline, en: tagline },
  streams: [],
  ads: 'unknown',
  ...fields,
});

const index = (stations: readonly Station[], lang: Lang = 'fr') => stations.map((s) => toEntry(s, lang));

/** Names of the stations found for `text`, best first. */
const search = (stations: readonly Station[], text: string, lang: Lang = 'fr', limit?: number): string[] =>
  matchNetwork(index(stations, lang), text, limit).map((s) => s.name);

/** Line words: jazz → "Jazz & classique" / "Jazz & classical", monde → "Monde" / "World", fip → "FIP". */
const network = [
  station('TSF Jazz', 'jazz', 'Paris'),
  station('Jazz Radio', 'jazz', 'Lyon'),
  station('Radio Classique', 'jazz', 'Paris'),
  station('Jazzy FM', 'monde', 'Bordeaux'),
  station('FIP', 'fip', 'Éclectique'),
  station('WWOZ', 'jazz', 'Jazz de La Nouvelle-Orléans'),
];

describe('toEntry', () => {
  const couleur3 = station('Couleur 3', 'monde', '', {
    country: 'CH',
    tagline: { fr: 'La radio qui dérange', en: 'Swiss alternative radio' },
  });

  it('indexes the name, both taglines and the country in the reader’s language, and the line apart', () => {
    expect(toEntry(couleur3, 'fr')).toEqual({
      station: couleur3,
      name: 'couleur 3',
      nameWords: ['couleur', '3'],
      words: ['couleur', '3', 'la', 'radio', 'qui', 'derange', 'swiss', 'alternative', 'suisse'],
      lineWords: ['monde', 'world'],
    });
    expect(toEntry(couleur3, 'en').words.at(-1)).toBe('switzerland');
  });

  it('files custom stations under “My stations”, whatever line they claim', () => {
    const mine = toEntry(station('Ma Radio', 'monde', 'radio.example', { custom: true }), 'fr');
    expect(mine.words).toEqual(['ma', 'radio', 'example']);
    expect(mine.lineWords).toEqual(['mes', 'stations', 'my']);
  });

  it('folds accents, case and apostrophes in the name', () => {
    const entry = toEntry(station('L’Été  Indien', 'monde', ''), 'fr');
    expect(entry.name).toBe('l ete indien');
    expect(entry.nameWords).toEqual(['l', 'ete', 'indien']);
  });
});

describe('matchNetwork', () => {
  it('ranks names starting with the query, then names with a word starting with it, then other matches', () => {
    expect(search(network, 'jazz')).toEqual(['Jazz Radio', 'Jazzy FM', 'TSF Jazz', 'WWOZ']);
  });

  it('finds stations by the name of their line only when nothing answers directly', () => {
    expect(search(network, 'classi')).toEqual(['Radio Classique']);
    expect(search(network, 'world')).toEqual(['Jazzy FM']);
    expect(search(network, 'jazz classique')).toEqual(['TSF Jazz', 'Jazz Radio', 'Radio Classique', 'WWOZ']);
  });

  it('needs every typed word, in any order, at the start of a word', () => {
    expect(search(network, 'radio jazz')).toEqual(['Jazz Radio']);
    expect(search(network, 'jazz ra')).toEqual(['Jazz Radio']);
    expect(search(network, 'azz')).toEqual([]);
    expect(search(network, 'jazz rock')).toEqual([]);
  });

  it('ignores accents, case and punctuation in what is typed', () => {
    expect(search(network, 'ÉCLECT')).toEqual(['FIP']);
    expect(search(network, 'eclectique')).toEqual(['FIP']);
    expect(search(network, '  Jazz,   RADIO! ')).toEqual(['Jazz Radio']);
  });

  it.each(['', '   ', '—', '?!', '’'])('finds nothing for %j', (text) => {
    expect(search(network, text)).toEqual([]);
  });

  it('keeps the network order among equals and stops at the limit', () => {
    const many = Array.from({ length: 20 }, (_, i) => station(`Jazz ${i + 1}`, 'jazz', ''));
    const found = search(many, 'jazz');
    expect(found).toHaveLength(12);
    expect(found.slice(0, 3)).toEqual(['Jazz 1', 'Jazz 2', 'Jazz 3']);
    expect(search(many, 'jazz', 'fr', 3)).toEqual(['Jazz 1', 'Jazz 2', 'Jazz 3']);
  });

  it('finds a country by its name in the reader’s language', () => {
    const swiss = [station('Couleur 3', 'monde', 'Alternative', { country: 'CH' })];
    expect(search(swiss, 'suisse', 'fr')).toEqual(['Couleur 3']);
    expect(search(swiss, 'switz', 'en')).toEqual(['Couleur 3']);
    expect(search(swiss, 'suisse', 'en')).toEqual([]);
  });

  describe('on the real network', () => {
    const real = (text: string, lang: Lang = 'fr') => matchNetwork(index(catalog, lang), text).map((s) => s.id);

    it('puts the station named like the query first', () => {
      expect(real('fip').slice(0, 2)).toEqual(['fip', 'fiprock']);
      expect(real('inter')[0]).toBe('franceinter');
      expect(real('culture')[0]).toBe('franceculture');
      expect(real('opera')[0]).toBe('francemusiqueopera');
      expect(real('mouv’')[0]).toBe('mouv');
    });

    it('finds stations by genre, tagline or country', () => {
      expect(real('sacre francais')).toEqual(['fipsacrefrancais']);
      expect(real('international')).toContain('rfi');
      expect(real('suisse')).toEqual(expect.arrayContaining(['swissjazz', 'swissclassic']));
      expect(real('switzerland', 'en')).toEqual(expect.arrayContaining(['swissjazz', 'swissclassic']));
    });

    it('does not offer the classical stations of “Jazz & classique” to someone looking for jazz', () => {
      const jazz = real('jazz');
      expect(jazz).toEqual(expect.arrayContaining(['tsfjazz', 'swissjazz', 'jazz24', 'wwoz']));
      for (const classical of ['swissclassic', 'brklassik', 'veniceclassic']) expect(jazz).not.toContain(classical);
    });
  });
});
