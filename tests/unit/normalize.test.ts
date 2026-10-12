import { describe, expect, it } from 'vitest';
import kexp from '../fixtures/kexp.json';
import nts from '../fixtures/nts.json';
import rfFip from '../fixtures/rf-fip.json';
import rfFiprock from '../fixtures/rf-fiprock.json';
import rfInter from '../fixtures/rf-inter.json';
import rfLajazz from '../fixtures/rf-lajazz.json';
import rfMusique from '../fixtures/rf-musique.json';
import somafm from '../fixtures/somafm.json';
import {
  clampRefresh,
  decodeEntities,
  normalizeKexp,
  normalizeNts,
  normalizeRadioFrance,
  normalizeSomaFm,
  radioFranceCover,
  refreshDelay,
  UnknownFormat,
} from '../../src/core/now-playing/normalize';

const SECOND = 1_000;
const MINUTE = 60_000;

/** A Radio France livemeta item; times are in seconds, as the API sends them. */
const rfItem = (fields: Record<string, unknown>) => ({
  firstLine: null,
  secondLine: null,
  cover: null,
  startTime: null,
  endTime: null,
  ...fields,
});

const rfAnswer = (now: unknown, next: unknown[] = [], delayToRefresh?: number) => ({
  prev: [],
  now,
  next,
  ...(delayToRefresh === undefined ? {} : { delayToRefresh }),
});

/** A programme from 18:00 to 19:00 (Paris time) on the fixtures' day. */
const SHOW_START = 1_791_734_400;
const SHOW_END = 1_791_738_000;
const show = (firstLine: string | null, secondLine: string | null) =>
  rfItem({ firstLine, secondLine, startTime: SHOW_START, endTime: SHOW_END });
const DURING_SHOW = SHOW_START * SECOND + 10 * MINUTE;

const cover = (uuid: string) => `https://www.radiofrance.fr/pikapi/images/${uuid}/400x400`;

function expectUnknownFormat(run: () => unknown): void {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(UnknownFormat);
  expect(caught).toBeInstanceOf(Error);
  expect((caught as Error).name).toBe('UnknownFormat');
}

describe('normalizeRadioFrance', () => {
  it('reads a song as "Artist • Title", with its cover, times and the next song (FIP)', () => {
    const start = 1_791_734_726_000;
    expect(normalizeRadioFrance(rfFip, start + MINUTE)).toEqual({
      kind: 'song',
      title: "Andre chenier : Come un bel di di maggio (acte IV) air d'André Chenier",
      subtitle: 'Placido Domingo',
      cover: cover('1f207ab7-e0d5-49f6-a9f1-d26e1d4c174e'),
      start,
      end: 1_791_734_916_000,
      next: { title: 'E penso a te', subtitle: 'Lucio Battisti', start: 1_791_734_916_000 },
      // The API suggests 160 s but the song ends in 130 s: poll 3 s after its end.
      refreshIn: 133_000,
    });
  });

  it.each([
    ['FIP Rock', rfFiprock, 'Angel of mercy', 'Dire Straits', 'Accidents will happen'],
    ['La Jazz', rfLajazz, "People's thoughts", 'Airelle Besson', 'Thoughtography'],
  ])('reads the song on air on the %s webradio', (_name, json, title, artist, nextTitle) => {
    const np = normalizeRadioFrance(json, json.now.startTime * SECOND);
    expect(np).toMatchObject({ kind: 'song', title, subtitle: artist, next: { title: nextTitle } });
  });

  it('keeps the whole line as the title of a song without an artist', () => {
    const np = normalizeRadioFrance(rfAnswer(rfItem({ firstLine: 'FIP', secondLine: 'Untitled', secondLineSongUuid: 'u' })), 0);
    expect(np).toMatchObject({ kind: 'song', title: 'Untitled' });
    expect(np?.subtitle).toBeUndefined();
  });

  it('builds the cover URL from the image uuid', () => {
    expect(radioFranceCover('abc-123')).toBe('https://www.radiofrance.fr/pikapi/images/abc-123/400x400');
  });

  it('reads a programme with its episode as the subtitle (France Inter)', () => {
    expect(normalizeRadioFrance(rfInter, DURING_SHOW)).toEqual({
      kind: 'program',
      title: 'Le journal de 18h du week-end',
      subtitle: 'Le journal de 18h00 du dimanche 11 octobre 2026',
      cover: cover('9b9b0fa1-a0bf-43d9-bb71-9950264a1730'),
      start: SHOW_START * SECOND,
      end: SHOW_END * SECOND,
      // A part of the 18:00–19:00 slot: it follows, at no time of its own.
      next: {
        title: 'La chronique de Paola Puerari',
        subtitle: 'Le 18/20 du dimanche du dimanche 11 octobre 2026',
      },
      refreshIn: 370_000,
    });
  });

  it('does not mistake an ellipsis inside the episode title for a series title (France Musique)', () => {
    expect(normalizeRadioFrance(rfMusique, DURING_SHOW)).toMatchObject({
      kind: 'program',
      title: 'Retour de plage',
      subtitle: "Villes d'Europe (Londres, Berlin, Rome…)",
    });
  });

  it('titles "Le direct" by its second line, even without times', () => {
    const [direct] = rfInter.prev;
    const np = normalizeRadioFrance(rfAnswer(direct, [], 60_000), DURING_SHOW);
    expect(np).toMatchObject({ kind: 'program', title: 'Le direct de France Inter' });
    expect(np?.subtitle).toBeUndefined();
    expect(np?.start).toBeUndefined();
    expect(np?.refreshIn).toBe(60_000);
  });

  it('titles a timed "Le direct" slot by its second line', () => {
    const np = normalizeRadioFrance(rfAnswer(show('Le direct', 'Le 18/20')), DURING_SHOW);
    expect(np).toMatchObject({ kind: 'program', title: 'Le 18/20', start: SHOW_START * SECOND, end: SHOW_END * SECOND });
    expect(np?.subtitle).toBeUndefined();
  });

  it('drops a subtitle that repeats the title or announces "Le direct"', () => {
    expect(normalizeRadioFrance(rfAnswer(show('Le 7/10', 'Le 7/10')), DURING_SHOW)?.subtitle).toBeUndefined();
    const np = normalizeRadioFrance(rfAnswer(show('Le 7/10', 'Le direct de France Inter')), DURING_SHOW);
    expect(np).toMatchObject({ kind: 'program', title: 'Le 7/10' });
    expect(np?.subtitle).toBeUndefined();
  });

  it('titles a timed item that only has a second line by that line', () => {
    const np = normalizeRadioFrance(rfAnswer(show(null, 'Concert du soir')), DURING_SHOW);
    expect(np).toMatchObject({ kind: 'program', title: 'Concert du soir' });
    expect(np?.subtitle).toBeUndefined();
  });

  describe('series titled with an ellipsis', () => {
    it.each(['La radio de...', 'La radio de…', 'La radio de …'])('names the episode in full for "%s"', (series) => {
      const np = normalizeRadioFrance(rfAnswer(show(series, 'La radio de Noor')), DURING_SHOW);
      expect(np).toMatchObject({ kind: 'program', title: 'La radio de Noor' });
      expect(np?.subtitle).toBeUndefined();
    });

    it('keeps the series title when the episode does not continue it', () => {
      expect(normalizeRadioFrance(rfAnswer(show('La radio de...', 'Spéciale rentrée')), DURING_SHOW)).toMatchObject({
        title: 'La radio de...',
        subtitle: 'Spéciale rentrée',
      });
    });

    it('needs an ellipsis: a plain series title is kept with its episode as the subtitle', () => {
      expect(normalizeRadioFrance(rfAnswer(show('La radio de', 'La radio de Noor')), DURING_SHOW)).toMatchObject({
        title: 'La radio de',
        subtitle: 'La radio de Noor',
      });
    });
  });

  describe('webradios between songs', () => {
    it('show the station description as an "about" item, polled every minute', () => {
      const [description] = rfFip.prev;
      const np = normalizeRadioFrance({ ...rfFip, now: description }, 1_791_734_726_000);
      expect(np).toMatchObject({
        kind: 'about',
        title: 'La radio la plus éclectique du monde',
        cover: cover('34e98566-058b-428f-a39e-d74bdef1cf77'),
        next: { title: 'E penso a te', subtitle: 'Lucio Battisti' },
        refreshIn: 60_000,
      });
      expect(np?.start).toBeUndefined();
      expect(np?.end).toBeUndefined();
    });

    it('return null when the untimed item has no text to show', () => {
      expect(normalizeRadioFrance(rfAnswer(rfItem({ firstLine: 'FIP', secondLine: null })), 0)).toBeNull();
      expect(normalizeRadioFrance(rfAnswer(rfItem({ firstLine: 'FIP', secondLine: '   ' })), 0)).toBeNull();
    });
  });

  it('returns null for a timed item without any text', () => {
    expect(normalizeRadioFrance(rfAnswer(show(null, null)), DURING_SHOW)).toBeNull();
    expect(normalizeRadioFrance(rfAnswer(show('', '')), DURING_SHOW)).toBeNull();
  });

  describe('next item', () => {
    it('skips "about" items', () => {
      const description = rfItem({ firstLine: 'FIP', secondLine: 'La radio la plus éclectique du monde' });
      const song = rfItem({
        firstLine: 'FIP',
        secondLine: 'Lucio Battisti • E penso a te',
        secondLineSongUuid: 'u',
        startTime: SHOW_END,
        endTime: SHOW_END + 200,
      });
      expect(normalizeRadioFrance(rfAnswer(show('Le 18/20', null), [description, song]), DURING_SHOW)?.next).toEqual({
        title: 'E penso a te',
        subtitle: 'Lucio Battisti',
        start: SHOW_END * SECOND,
      });
    });

    it('is absent when only "about" items follow (France Musique)', () => {
      expect(normalizeRadioFrance(rfMusique, DURING_SHOW)?.next).toBeUndefined();
    });

    it('is absent when the answer has no list of next items', () => {
      expect(normalizeRadioFrance({ now: show('Le 18/20', null), next: null }, DURING_SHOW)?.next).toBeUndefined();
      expect(normalizeRadioFrance({ now: show('Le 18/20', null) }, DURING_SHOW)?.next).toBeUndefined();
    });

    it('skips the next part of the programme on air, whatever its capitals', () => {
      const LATER = SHOW_END + 3_600;
      const secondPart = rfItem({ firstLine: 'Le 18/20', secondLine: 'Le débat', startTime: SHOW_END, endTime: LATER });
      const thirdPart = rfItem({ firstLine: 'LE 18/20', startTime: LATER, endTime: LATER + 600 });
      const following = rfItem({ firstLine: 'Le Masque et la Plume', startTime: LATER + 600, endTime: LATER + 3_600 });
      const answer = rfAnswer(show('Le 18/20', null), [secondPart, thirdPart, following]);
      expect(normalizeRadioFrance(answer, DURING_SHOW)?.next).toEqual({
        title: 'Le Masque et la Plume',
        start: (LATER + 600) * SECOND,
      });
    });

    it('has no time when it starts before the programme on air ends, as parts of a show do', () => {
      const part = rfItem({ firstLine: 'La chronique de Paola Puerari', startTime: SHOW_START, endTime: SHOW_END });
      expect(normalizeRadioFrance(rfAnswer(show('Le journal de 18h', null), [part]), DURING_SHOW)?.next).toEqual({
        title: 'La chronique de Paola Puerari',
      });
    });

    it('keeps its time when the programme on air has no end only if that time is still to come', () => {
      const onAir = rfItem({ firstLine: 'Le 18/20', startTime: SHOW_START });
      const begun = rfItem({ firstLine: 'Le Masque et la Plume', startTime: SHOW_START + 300 });
      const later = rfItem({ firstLine: 'Le Masque et la Plume', startTime: SHOW_END });
      expect(normalizeRadioFrance(rfAnswer(onAir, [begun]), DURING_SHOW)?.next).toEqual({ title: 'Le Masque et la Plume' });
      expect(normalizeRadioFrance(rfAnswer(onAir, [later]), DURING_SHOW)?.next).toEqual({
        title: 'Le Masque et la Plume',
        start: SHOW_END * SECOND,
      });
    });

    it('is absent when only parts of the programme on air follow', () => {
      const secondPart = rfItem({ firstLine: 'Le 18/20', startTime: SHOW_END, endTime: SHOW_END + 3_600 });
      expect(normalizeRadioFrance(rfAnswer(show('Le 18/20', null), [secondPart]), DURING_SHOW)?.next).toBeUndefined();
    });

    it('keeps a song that bears the title of the song on air', () => {
      const song = (artist: string, start: number) =>
        rfItem({ firstLine: 'FIP', secondLine: `${artist} • Intro`, secondLineSongUuid: artist, startTime: start, endTime: start + 200 });
      const answer = rfAnswer(song('The xx', SHOW_START), [song('Alt-J', SHOW_START + 200)]);
      expect(normalizeRadioFrance(answer, DURING_SHOW)?.next).toEqual({
        title: 'Intro',
        subtitle: 'Alt-J',
        start: (SHOW_START + 200) * SECOND,
      });
    });
  });

  describe('refreshIn', () => {
    it('follows delayToRefresh while the item lasts longer', () => {
      expect(normalizeRadioFrance(rfAnswer(show('Le 18/20', null), [], 120_000), DURING_SHOW)?.refreshIn).toBe(120_000);
    });

    it('comes 3 s after the end of the item when that is sooner', () => {
      const halfAMinuteBeforeEnd = SHOW_END * SECOND - 30 * SECOND;
      expect(normalizeRadioFrance(rfAnswer(show('Le 18/20', null), [], 120_000), halfAMinuteBeforeEnd)?.refreshIn).toBe(
        33_000,
      );
    });

    it('is never longer than 10 minutes (France Musique asks for an hour)', () => {
      expect(rfMusique.delayToRefresh).toBe(3_600_000);
      expect(normalizeRadioFrance(rfMusique, SHOW_START * SECOND)?.refreshIn).toBe(10 * MINUTE);
    });

    it('is never shorter than 15 s, even once the item is over', () => {
      expect(normalizeRadioFrance(rfAnswer(show('Le 18/20', null), [], 120_000), SHOW_END * SECOND + MINUTE)?.refreshIn).toBe(
        15_000,
      );
    });

    it('defaults to one minute without delayToRefresh', () => {
      expect(normalizeRadioFrance(rfAnswer(show('Le 18/20', null)), DURING_SHOW)?.refreshIn).toBe(60_000);
    });
  });

  it.each<[string, unknown]>([
    ['null', null],
    ['a string', 'Service Unavailable'],
    ['an empty object', {}],
    ['a null "now"', { now: null }],
    ['a list as the answer', [rfFip]],
    ['a "now" without firstLine and secondLine', { now: { title: 'Le 18/20', startTime: SHOW_START } }],
  ])('throws UnknownFormat for %s', (_name, json) => {
    expectUnknownFormat(() => normalizeRadioFrance(json, DURING_SHOW));
  });

  it('accepts a "now" that has only one of firstLine and secondLine', () => {
    expect(normalizeRadioFrance({ now: { secondLine: 'Concert du soir', startTime: SHOW_START } }, DURING_SHOW)?.title).toBe(
      'Concert du soir',
    );
    expect(normalizeRadioFrance({ now: { firstLine: 'Concert du soir', startTime: SHOW_START } }, DURING_SHOW)?.title).toBe(
      'Concert du soir',
    );
  });
});

describe('normalizeKexp', () => {
  it('reads the track play', () => {
    expect(normalizeKexp(kexp)).toEqual({
      kind: 'song',
      title: "Derek's Blues",
      subtitle: 'Natural Child',
      cover: undefined,
      start: Date.parse('2026-10-11T16:00:34Z'),
      refreshIn: 30_000,
    });
  });

  it('prefers the full image and falls back to the thumbnail', () => {
    const [play] = kexp.results;
    const withImages = { results: [{ ...play, image_uri: 'https://kexp.test/full.jpg', thumbnail_uri: 'https://kexp.test/thumb.jpg' }] };
    expect(normalizeKexp(withImages)?.cover).toBe('https://kexp.test/full.jpg');
    const thumbnailOnly = { results: [{ ...play, image_uri: '', thumbnail_uri: 'https://kexp.test/thumb.jpg' }] };
    expect(normalizeKexp(thumbnailOnly)?.cover).toBe('https://kexp.test/thumb.jpg');
  });

  it('leaves the start unknown when the air date cannot be read', () => {
    const [play] = kexp.results;
    expect(normalizeKexp({ results: [{ ...play, airdate: 'yesterday' }] })?.start).toBeUndefined();
  });

  it('returns null during an air break', () => {
    expect(normalizeKexp({ results: [{ id: 1, airdate: '2026-10-11T09:03:00-07:00', play_type: 'airbreak' }] })).toBeNull();
  });

  it('returns null when nothing has been played or the song has no title', () => {
    const [play] = kexp.results;
    expect(normalizeKexp({ results: [] })).toBeNull();
    expect(normalizeKexp({ results: [{ ...play, song: '' }] })).toBeNull();
    expect(normalizeKexp({ results: [{ ...play, song: null }] })).toBeNull();
  });

  it.each<[string, unknown]>([
    ['null', null],
    ['an empty object', {}],
    ['"results" that is not a list', { results: { song: 'x' } }],
    ['a track play without "song"', { results: [{ play_type: 'trackplay', artist: 'Natural Child' }] }],
  ])('throws UnknownFormat for %s', (_name, json) => {
    expectUnknownFormat(() => normalizeKexp(json));
  });
});

describe('normalizeSomaFm', () => {
  it('reads the latest song', () => {
    expect(normalizeSomaFm(somafm)).toEqual({
      kind: 'song',
      title: 'Into a distant light (Glint Remix)',
      subtitle: 'Thomas Lemmer',
      cover: undefined,
      start: 1_791_734_540_000,
      refreshIn: 30_000,
    });
  });

  it('uses the album art as the cover', () => {
    const [song] = somafm.songs;
    expect(normalizeSomaFm({ songs: [{ ...song, albumArt: 'https://somafm.test/art.jpg' }] })?.cover).toBe(
      'https://somafm.test/art.jpg',
    );
  });

  it('leaves the start unknown without a usable date', () => {
    const [song] = somafm.songs;
    expect(normalizeSomaFm({ songs: [{ ...song, date: '0' }] })?.start).toBeUndefined();
    expect(normalizeSomaFm({ songs: [{ ...song, date: 'soon' }] })?.start).toBeUndefined();
  });

  it('returns null for an empty list or a song without a title', () => {
    const [song] = somafm.songs;
    expect(normalizeSomaFm({ songs: [] })).toBeNull();
    expect(normalizeSomaFm({ songs: [{ ...song, title: '' }] })).toBeNull();
  });

  it.each<[string, unknown]>([
    ['null', null],
    ['an empty object', {}],
    ['"songs" that is not a list', { songs: 'none' }],
    ['a song without "title"', { songs: [{ artist: 'Thomas Lemmer', date: '1791734540' }] }],
  ])('throws UnknownFormat for %s', (_name, json) => {
    expectUnknownFormat(() => normalizeSomaFm(json));
  });
});

describe('normalizeNts', () => {
  const ch1Start = Date.parse('2026-10-11T17:00:00+01:00');

  it('reads channel 1 with its place, cover and next show', () => {
    expect(normalizeNts(nts, '1', ch1Start + 30 * MINUTE)).toEqual({
      kind: 'program',
      title: 'A Month of Sundays w/ Bill Spencer',
      subtitle: 'Detroit',
      cover: 'https://media2.ntslive.co.uk/resize/800x800/92a0b080-b13d-4016-8e15-0603d4d80065_1655683200.png',
      start: ch1Start,
      end: Date.parse('2026-10-11T18:00:00+01:00'),
      next: { title: 'm00dtapes', start: Date.parse('2026-10-11T18:00:00+01:00') },
      refreshIn: 5 * MINUTE,
    });
  });

  it('reads channel 2 and decodes HTML entities in the title', () => {
    const end = Date.parse('2026-10-11T19:00:00+01:00');
    expect(normalizeNts(nts, '2', end - MINUTE)).toMatchObject({
      kind: 'program',
      title: 'Hip-Hop & Soul w/ Guests',
      subtitle: 'London',
      end,
      next: { title: 'Post Punk Britain: In Focus - Martin Hannett (R)' },
      refreshIn: 63_000,
    });
  });

  it('falls back to the medium picture', () => {
    const answer = structuredClone(nts);
    const [channel] = answer.results;
    if (!channel) throw new Error('fixture has no channel');
    channel.now.embeds.details.media.picture_medium_large = '';
    expect(normalizeNts(answer, '1', ch1Start)?.cover).toBe(
      'https://media.ntslive.co.uk/resize/400x400/92a0b080-b13d-4016-8e15-0603d4d80065_1655683200.png',
    );
  });

  it('returns null when the channel airs a broadcast without a title', () => {
    expect(normalizeNts({ results: [{ channel_name: '1', now: { broadcast_title: '' } }] }, '1', ch1Start)).toBeNull();
  });

  it('keeps a title with a reference beyond Unicode as it is', () => {
    const answer = { results: [{ channel_name: '1', now: { broadcast_title: 'Mix &#x110000; Live' } }] };
    expect(normalizeNts(answer, '1', ch1Start)?.title).toBe('Mix &#x110000; Live');
  });

  it('has no next show when the next broadcast is unknown', () => {
    const answer = { results: [{ channel_name: '1', now: { broadcast_title: 'Live' }, next: null }] };
    expect(normalizeNts(answer, '1', ch1Start)).toMatchObject({ title: 'Live', refreshIn: 5 * MINUTE });
    expect(normalizeNts(answer, '1', ch1Start)?.next).toBeUndefined();
  });

  it.each<[string, unknown, '1' | '2']>([
    ['null', null, '1'],
    ['an empty object', {}, '1'],
    ['"results" that is not a list', { results: {} }, '1'],
    ['an empty list of channels', { results: [] }, '1'],
    ['a missing channel', { results: [nts.results[0]] }, '2'],
    ['a channel without "now"', { results: [{ channel_name: '1' }] }, '1'],
    ['a channel with a null "now"', { results: [{ channel_name: '1', now: null }] }, '1'],
  ])('throws UnknownFormat for %s', (_name, json, channel) => {
    expectUnknownFormat(() => normalizeNts(json, channel, ch1Start));
  });
});

describe('decodeEntities', () => {
  it('decodes the named entities feeds use, in any case', () => {
    expect(decodeEntities('&amp; &lt; &gt; &quot; &apos; &nbsp;')).toBe('& < > " \' \u00a0');
    expect(decodeEntities('R&AMP;B')).toBe('R&B');
  });

  it('decodes decimal and hexadecimal references', () => {
    expect(decodeEntities('&#233;t&#233;')).toBe('été');
    expect(decodeEntities('&#xE9;t&#Xe9;')).toBe('été');
    expect(decodeEntities('&#128251; &#x1F4FB;')).toBe('📻 📻');
  });

  it('leaves unknown entities and bare ampersands untouched', () => {
    expect(decodeEntities('&eacute;&copy;')).toBe('&eacute;&copy;');
    expect(decodeEntities('Simon & Garfunkel &; &#;')).toBe('Simon & Garfunkel &; &#;');
  });

  it('leaves references beyond Unicode untouched instead of throwing', () => {
    expect(decodeEntities('A &#x110000; B')).toBe('A &#x110000; B');
    expect(decodeEntities('A &#99999999999; B')).toBe('A &#99999999999; B');
  });
});

describe('refresh bounds', () => {
  it('clamps between 15 s and 10 min', () => {
    expect(clampRefresh(-1)).toBe(15_000);
    expect(clampRefresh(0)).toBe(15_000);
    expect(clampRefresh(14_999)).toBe(15_000);
    expect(clampRefresh(15_000)).toBe(15_000);
    expect(clampRefresh(90_000)).toBe(90_000);
    expect(clampRefresh(10 * MINUTE)).toBe(10 * MINUTE);
    expect(clampRefresh(10 * MINUTE + 1)).toBe(10 * MINUTE);
    expect(clampRefresh(Number.POSITIVE_INFINITY)).toBe(10 * MINUTE);
  });

  it('takes the hint when nothing ends sooner', () => {
    expect(refreshDelay(90_000, undefined, 0)).toBe(90_000);
    expect(refreshDelay(90_000, 10 * MINUTE, 0)).toBe(90_000);
  });

  it('polls 3 s after the end of the current item when it ends before the hint', () => {
    expect(refreshDelay(90_000, 30_000, 0)).toBe(33_000);
  });

  it('applies the bounds to both the hint and the end', () => {
    expect(refreshDelay(5_000, undefined, 0)).toBe(15_000);
    expect(refreshDelay(3_600_000, undefined, 0)).toBe(10 * MINUTE);
    expect(refreshDelay(90_000, 5_000, 0)).toBe(15_000);
    expect(refreshDelay(90_000, 0, MINUTE)).toBe(15_000);
  });
});
