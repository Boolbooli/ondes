import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { fitArtText, stationArtSvg } from '../core/station-art';
import type { Station } from '../core/types';
import { lineById } from '../data/lines';
import { homeLine } from '../state/store';

let fontsReady: Promise<unknown> | undefined;
const whenFontsReady = (): Promise<unknown> =>
  (fontsReady ??= typeof document !== 'undefined' && document.fonts ? document.fonts.ready : Promise.resolve());

/** The station's enamel plaque, drawn inline so it is sharp at every size and works offline. */
export function StationArt({ station, class: className = '' }: { station: Station; class?: string }) {
  const html = useMemo(() => stationArtSvg(station.name, lineById(homeLine(station))), [station]);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    let alive = true;
    const element = ref.current;
    if (!element) return;
    fitArtText(element);
    void whenFontsReady().then(() => {
      if (alive) fitArtText(element);
    });
    return () => {
      alive = false;
    };
  }, [html]);
  return <div ref={ref} class={`art ${className}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Programme or album cover over the plaque, shown once it has loaded. */
export function CoverArt({ station, cover, class: className = '' }: { station: Station; cover?: string; class?: string }) {
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const show = cover && failed !== cover;
  return (
    <div class={`cover ${className}`}>
      <StationArt station={station} />
      {show && (
        <img
          key={cover}
          class={`cover__img${loaded === cover ? ' is-loaded' : ''}`}
          src={cover}
          alt=""
          decoding="async"
          referrerpolicy="no-referrer"
          onLoad={() => setLoaded(cover)}
          onError={() => setFailed(cover)}
        />
      )}
    </div>
  );
}
