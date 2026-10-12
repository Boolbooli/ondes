import { describe, expect, it } from 'vitest';
import type { PlaybackStatus } from '../../src/core/audio-engine';
import { dictionaries } from '../../src/core/i18n';
import type { Localized, NowPlaying, Station, StreamSource } from '../../src/core/types';
import {
  behindMinutes,
  describeStream,
  fold,
  ledWord,
  onAirText,
  onAirTitle,
  showProgress,
  stopStatus,
} from '../../src/ui/format';

const { fr, en } = dictionaries;

const station: Station = {
  id: 'essai',
  name: 'Radio Essai',
  line: 'monde',
  country: 'FR',
  tagline: { fr: 'La radio d\u2019essai', en: 'The test radio' },
  streams: [],
  ads: 'none',
};

const np = (fields: Omit<NowPlaying, 'refreshIn'>): NowPlaying => ({ ...fields, refreshIn: 30_000 });

/** Local wall-clock time, so the expected clock text does not depend on the time zone. */
const at = (hours: number, minutes: number): number => new Date(2026, 0, 5, hours, minutes).getTime();

const source = (
  kind: StreamSource['kind'],
  codec: string,
  bitrate: number,
  quality: StreamSource['quality'] = 'hifi',
): StreamSource => ({ url: 'https://example.org/live', kind, codec, bitrate, quality });

/** Statuses other than `playing`, with their LED word and their long status on the map. */
const notPlaying: readonly { status: PlaybackStatus; led: Localized; long: Localized }[] = [
  { status: 'idle', led: { fr: 'Prête', en: 'Ready' }, long: { fr: 'Prête', en: 'Ready' } },
  {
    status: 'loading',
    led: { fr: '\u00c0 l\u2019approche', en: 'Arriving' },
    long: { fr: '\u00c0 l\u2019approche\u2026', en: 'Arriving\u2026' },
  },
  { status: 'paused', led: { fr: 'En pause', en: 'Paused' }, long: { fr: 'En pause', en: 'Paused' } },
  {
    status: 'retrying',
    led: { fr: 'Trafic perturbé', en: 'Disrupted' },
    long: { fr: 'Trafic perturbé', en: 'Service disrupted' },
  },
  { status: 'offline', led: { fr: 'Hors ligne', en: 'Offline' }, long: { fr: 'Hors ligne', en: 'Offline' } },
  { status: 'error', led: { fr: 'Interrompu', en: 'Stopped' }, long: { fr: 'Interrompu', en: 'Stopped' } },
];

describe('onAirText', () => {
  it('shows the station tagline in the listener’s language when nothing is known about the programme', () => {
    expect(onAirText(station, null, 'fr', fr)).toBe('La radio d\u2019essai');
    expect(onAirText(station, null, 'en', en)).toBe('The test radio');
  });

  it('joins a song and its artist', () => {
    const song = np({ kind: 'song', title: 'So What', subtitle: 'Miles Davis' });
    expect(onAirText(station, song, 'fr', fr)).toBe('So What · Miles Davis');
    expect(onAirText(station, song, 'en', en)).toBe('So What · Miles Davis');
  });

  it('shows a song alone when its artist is unknown or blank', () => {
    expect(onAirText(station, np({ kind: 'song', title: 'So What' }), 'fr', fr)).toBe('So What');
    expect(onAirText(station, np({ kind: 'song', title: 'So What', subtitle: '' }), 'en', en)).toBe('So What');
  });

  it('never gives a song an end time', () => {
    const song = np({ kind: 'song', title: 'So What', subtitle: 'Miles Davis', start: at(9, 0), end: at(9, 9) });
    expect(onAirText(station, song, 'fr', fr)).toBe('So What · Miles Davis');
  });

  it('gives a programme its end time on a 24-hour clock, in the listener’s language', () => {
    const morning = np({ kind: 'program', title: 'Le 7/10', subtitle: 'Présenté par…', start: at(7, 0), end: at(10, 0) });
    expect(onAirText(station, morning, 'fr', fr)).toBe('Le 7/10 · jusqu\u2019à 10:00');
    expect(onAirText(station, morning, 'en', en)).toBe('Le 7/10 · until 10:00');

    const afternoon = np({ kind: 'program', title: 'Le direct', end: at(14, 30) });
    expect(onAirText(station, afternoon, 'fr', fr)).toBe('Le direct · jusqu\u2019à 14:30');
    expect(onAirText(station, afternoon, 'en', en)).toBe('Le direct · until 14:30');
  });

  it('shows a programme alone when its end is unknown', () => {
    expect(onAirText(station, np({ kind: 'program', title: 'Le direct', start: at(7, 0) }), 'fr', fr)).toBe('Le direct');
  });

  it('shows only the title of a webradio’s about item', () => {
    const about = np({ kind: 'about', title: 'La radio de Noor', subtitle: 'Une sélection', end: at(10, 0) });
    expect(onAirText(station, about, 'fr', fr)).toBe('La radio de Noor');
    expect(onAirText(station, about, 'en', en)).toBe('La radio de Noor');
  });
});

describe('onAirTitle', () => {
  it('leaves out when a programme ends', () => {
    const morning = np({ kind: 'program', title: 'Le 7/10', start: at(7, 0), end: at(10, 0) });
    expect(onAirTitle(station, morning, 'fr')).toBe('Le 7/10');
  });

  it('keeps a song with its artist, and the tagline when nothing is known', () => {
    expect(onAirTitle(station, np({ kind: 'song', title: 'So What', subtitle: 'Miles Davis' }), 'en')).toBe(
      'So What · Miles Davis',
    );
    expect(onAirTitle(station, null, 'fr')).toBe('La radio d\u2019essai');
    expect(onAirTitle(station, null, 'en')).toBe('The test radio');
  });
});

describe('behindMinutes', () => {
  it.each([
    [8, 1],
    [89, 1],
    [90, 2],
    [150, 3],
    [600, 10],
    [4 * 3600, 240],
  ])('rounds %d s to %d min', (seconds, minutes) => {
    expect(behindMinutes(seconds)).toBe(minutes);
  });

  it('never says less than one minute', () => {
    expect(behindMinutes(0)).toBe(1);
    expect(behindMinutes(29)).toBe(1);
  });
});

describe('ledWord', () => {
  it('says live while playing less than 8 s behind the live point', () => {
    expect(ledWord('playing', 0, fr)).toBe('En direct');
    expect(ledWord('playing', 7, en)).toBe('Live');
    expect(ledWord('playing', 7.99, fr)).toBe('En direct');
  });

  it('says delayed while playing 8 s or more behind the live point', () => {
    expect(ledWord('playing', 8, fr)).toBe('Différé');
    expect(ledWord('playing', 8, en)).toBe('Delayed');
    expect(ledWord('playing', 4 * 3600, en)).toBe('Delayed');
  });

  it.each(notPlaying)('shows the $status word whatever the delay', ({ status, led }) => {
    for (const behind of [0, 8, 600]) {
      expect(ledWord(status, behind, fr)).toBe(led.fr);
      expect(ledWord(status, behind, en)).toBe(led.en);
    }
  });
});

describe('stopStatus', () => {
  it('says live while playing less than 8 s behind the live point', () => {
    expect(stopStatus('playing', 0, fr)).toBe('En direct');
    expect(stopStatus('playing', 7, en)).toBe('Live');
  });

  it('gives the delay in whole minutes while playing 8 s or more behind', () => {
    expect(stopStatus('playing', 8, fr)).toBe('Différé \u22121 min');
    expect(stopStatus('playing', 8, en)).toBe('1 min behind');
    expect(stopStatus('playing', 150, fr)).toBe('Différé \u22123 min');
    expect(stopStatus('playing', 4 * 3600, en)).toBe('240 min behind');
  });

  it.each(notPlaying)('shows the $status status whatever the delay', ({ status, long }) => {
    for (const behind of [0, 8, 600]) {
      expect(stopStatus(status, behind, fr)).toBe(long.fr);
      expect(stopStatus(status, behind, en)).toBe(long.en);
    }
  });
});

describe('showProgress', () => {
  const show = np({ kind: 'program', title: 'Le 7/10', start: at(7, 0), end: at(10, 0) });

  it('is the share of the programme already aired', () => {
    expect(showProgress(show, at(7, 45))).toBe(0.25);
    expect(showProgress(show, at(8, 30))).toBe(0.5);
  });

  it('stays between 0 and 1 outside the programme', () => {
    expect(showProgress(show, at(6, 0))).toBe(0);
    expect(showProgress(show, at(7, 0))).toBe(0);
    expect(showProgress(show, at(10, 0))).toBe(1);
    expect(showProgress(show, at(11, 0))).toBe(1);
  });

  it('works for any item with both times', () => {
    expect(showProgress(np({ kind: 'song', title: 'So What', start: at(9, 0), end: at(9, 10) }), at(9, 1))).toBeCloseTo(0.1);
  });

  it('is unknown without a programme or without both times', () => {
    expect(showProgress(null, at(8, 0))).toBeNull();
    expect(showProgress(np({ kind: 'program', title: 'Le direct' }), at(8, 0))).toBeNull();
    expect(showProgress(np({ kind: 'program', title: 'Le direct', start: at(7, 0) }), at(8, 0))).toBeNull();
    expect(showProgress(np({ kind: 'program', title: 'Le direct', end: at(10, 0) }), at(8, 0))).toBeNull();
  });

  it('is unknown when the programme does not end after it starts', () => {
    expect(showProgress(np({ kind: 'program', title: 'Le direct', start: at(9, 0), end: at(9, 0) }), at(9, 0))).toBeNull();
    expect(showProgress(np({ kind: 'program', title: 'Le direct', start: at(10, 0), end: at(9, 0) }), at(9, 30))).toBeNull();
  });
});

describe('describeStream', () => {
  it('is empty without a stream', () => {
    expect(describeStream(undefined)).toBe('');
  });

  it.each([
    ['HLS · AAC 192 kbit/s', source('hls', 'AAC', 192)],
    ['HLS · HE-AAC 64 kbit/s', source('hls', 'HE-AAC', 64, 'eco')],
    ['Icecast · MP3 128 kbit/s', source('icy', 'MP3', 128, 'eco')],
    ['Icecast · AAC', source('icy', 'AAC', 0)],
    ['Icecast · 64 kbit/s', source('icy', '', 64)],
    ['Icecast', source('icy', '', 0)],
  ])('reads “%s”, leaving out what is unknown', (text, stream) => {
    expect(describeStream(stream)).toBe(text);
  });
});

describe('fold', () => {
  it('lower-cases and drops accents', () => {
    expect(fold('Fréquence Éclectique')).toBe('frequence eclectique');
    expect(fold('Ça plane pour moi')).toBe('ca plane pour moi');
    expect(fold('Opéra')).toBe('opera');
  });

  it('turns straight and curly apostrophes into spaces', () => {
    expect(fold('L\u2019Été indien')).toBe('l ete indien');
    expect(fold("Radio d'Ici")).toBe('radio d ici');
    expect(fold('Mouv\u2019')).toBe('mouv');
  });

  it('collapses and trims white space', () => {
    expect(fold('  TSF \t Jazz\n')).toBe('tsf jazz');
  });

  it('keeps digits and other punctuation', () => {
    expect(fold('BR-Klassik')).toBe('br-klassik');
    expect(fold('Le 7/10')).toBe('le 7/10');
  });

  it('is stable when applied twice', () => {
    for (const text of ['L\u2019Été indien', '  TSF \t Jazz\n', 'FIP Sacré français !', "Radio d'Ici"]) {
      expect(fold(fold(text))).toBe(fold(text));
    }
  });

  it('lets a query typed without accents or capitals match a name', () => {
    expect(fold('FIP Sacré français !')).toContain(fold('sacre FRANCAIS'));
    expect(fold('Mouv\u2019')).toBe(fold('mouv'));
  });
});
