import { describe, expect, it } from 'vitest';
import { looksLikePlaylist, parsePlaylist } from '../../src/core/playlist';

const lines = (...text: string[]) => text.join('\n');

describe('parsePlaylist — PLS', () => {
  it('returns the first entry', () => {
    const pls = lines(
      '[playlist]',
      'NumberOfEntries=2',
      'File1=https://a.example/stream',
      'Title1=Radio A',
      'Length1=-1',
      'File2=https://b.example/stream',
      'Version=2',
    );
    expect(parsePlaylist(pls)).toBe('https://a.example/stream');
  });

  it('takes the entry listed first, whatever its number', () => {
    expect(parsePlaylist(lines('[playlist]', 'File2=https://b.example/2', 'File1=https://a.example/1'))).toBe(
      'https://b.example/2',
    );
  });

  it('accepts any case, spaces around "=" and indented lines', () => {
    expect(parsePlaylist(lines('[Playlist]', '  file1 = https://a.example/stream  ', 'numberofentries=1'))).toBe(
      'https://a.example/stream',
    );
  });

  it('handles Windows line endings', () => {
    expect(parsePlaylist('[playlist]\r\nNumberOfEntries=1\r\nFile1=https://a.example/stream\r\n')).toBe(
      'https://a.example/stream',
    );
  });

  it('returns undefined when the playlist has no entry', () => {
    expect(parsePlaylist(lines('[playlist]', 'NumberOfEntries=0', 'Version=2'))).toBeUndefined();
  });

  it('does not fall back to bare URLs once the [playlist] header is seen', () => {
    expect(parsePlaylist(lines('[playlist]', 'https://a.example/stream'))).toBeUndefined();
  });
});

describe('parsePlaylist — M3U', () => {
  it('returns the first stream URL, skipping comments and directives', () => {
    const m3u = lines(
      '#EXTM3U',
      '#EXTINF:-1,Radio A',
      'https://a.example/live.mp3',
      '#EXTINF:-1,Radio B',
      'https://b.example/live.mp3',
    );
    expect(parsePlaylist(m3u)).toBe('https://a.example/live.mp3');
  });

  it('accepts a bare list of URLs with blank lines and Windows line endings', () => {
    expect(parsePlaylist('\r\n\r\n  https://a.example/live.aac  \r\nhttps://b.example/live.aac\r\n')).toBe(
      'https://a.example/live.aac',
    );
  });

  it('skips lines that are not absolute http(s) URLs', () => {
    expect(parsePlaylist(lines('live.mp3', 'ftp://a.example/live.mp3', 'HTTP://a.example/live.mp3'))).toBe(
      'HTTP://a.example/live.mp3',
    );
  });

  it('returns plain http URLs as they are; deciding whether they are acceptable is the caller’s job', () => {
    expect(parsePlaylist('http://a.example/live.mp3')).toBe('http://a.example/live.mp3');
  });

  it.each(['', '#EXTM3U', lines('#EXTM3U', '#EXTINF:-1,Nothing', 'relative/path.mp3')])(
    'returns undefined when there is no stream URL in %j',
    (text) => {
      expect(parsePlaylist(text)).toBeUndefined();
    },
  );

  it('returns undefined for an HLS media playlist, which is a stream itself', () => {
    const hls = lines(
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-TARGETDURATION:10',
      '#EXTINF:10.0,',
      'https://a.example/segment-1.aac',
    );
    expect(parsePlaylist(hls)).toBeUndefined();
  });

  it('returns undefined for an HLS master playlist', () => {
    const master = lines(
      '#EXTM3U',
      '#EXT-X-STREAM-INF:BANDWIDTH=128000,CODECS="mp4a.40.2"',
      'https://a.example/128/index.m3u8',
    );
    expect(parsePlaylist(master)).toBeUndefined();
  });
});

describe('looksLikePlaylist', () => {
  it.each([
    'https://a.example/listen.m3u',
    'https://a.example/listen.pls',
    'https://a.example/LISTEN.PLS',
    'https://a.example/listen.m3u?id=4',
    'https://a.example/listen.pls#hifi',
  ])('recognises %s', (url) => {
    expect(looksLikePlaylist(url)).toBe(true);
  });

  it.each([
    'https://a.example/live.m3u8',
    'https://a.example/live.mp3',
    'https://a.example/listen.pls/stream',
    'https://a.example/m3u',
    'https://a.example/live.aac?format=pls',
  ])('rejects %s', (url) => {
    expect(looksLikePlaylist(url)).toBe(false);
  });
});
