/** First stream URL in an M3U/M3U8 (non-HLS) or PLS playlist, if any. */
export function parsePlaylist(text: string): string | undefined {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  if (lines.some((line) => /^\[playlist\]$/i.test(line))) {
    for (const line of lines) {
      const match = /^File\d+\s*=\s*(\S+)/i.exec(line);
      if (match?.[1]) return match[1];
    }
    return undefined;
  }
  // HLS playlists are streams themselves, not lists of streams.
  if (lines.some((line) => line.startsWith('#EXT-X-'))) return undefined;
  return lines.find((line) => line && !line.startsWith('#') && /^https?:\/\//i.test(line));
}

export const looksLikePlaylist = (url: string): boolean => /\.(m3u|pls)(?:$|[?#])/i.test(url);
