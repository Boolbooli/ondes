import type { AdPolicy, LineId, Localized, MetaSource, Station, StreamSource } from '../core/types';

/**
 * The catalogue. Every URL here is the station's own public stream, checked by
 * `npm run check:streams`. Ondes never adds or replaces anything in these streams.
 */

const t = (fr: string, en: string = fr): Localized => ({ fr, en });

/** Radio France: HLS first (adaptive and robust on iOS), Icecast as a fallback. */
function rf(slug: string): StreamSource[] {
  return [
    { url: `https://stream.radiofrance.fr/${slug}/${slug}_hifi.m3u8?id=radiofrance`, kind: 'hls', codec: 'AAC', bitrate: 192, quality: 'hifi' },
    { url: `https://icecast.radiofrance.fr/${slug}-hifi.aac`, kind: 'icy', codec: 'AAC', bitrate: 192, quality: 'hifi' },
    { url: `https://stream.radiofrance.fr/${slug}/${slug}_midfi.m3u8?id=radiofrance`, kind: 'hls', codec: 'AAC', bitrate: 128, quality: 'eco' },
    { url: `https://icecast.radiofrance.fr/${slug}-midfi.mp3`, kind: 'icy', codec: 'MP3', bitrate: 128, quality: 'eco' },
  ];
}

const icy = (url: string, codec: string, bitrate: number, quality: StreamSource['quality'] = 'hifi'): StreamSource => ({
  url,
  kind: 'icy',
  codec,
  bitrate,
  quality,
});

const hls = (url: string, codec: string, bitrate: number, quality: StreamSource['quality'] = 'hifi'): StreamSource => ({
  url,
  kind: 'hls',
  codec,
  bitrate,
  quality,
});

const rfMeta = (id: number, rules: string): MetaSource => ({ kind: 'radiofrance', id, rules: `transistor_${rules}_player` });

interface Def {
  id: string;
  name: string;
  line: LineId;
  country: string;
  tagline: Localized;
  streams: StreamSource[];
  ads: AdPolicy;
  meta?: MetaSource;
  site?: string;
  timeshift?: Station['timeshift'];
}

const station = (def: Def): Station => def;

function fipWeb(slug: string, id: number, name: string, tagline: Localized): Station {
  return station({
    id: slug,
    name,
    line: 'fip',
    country: 'FR',
    tagline,
    streams: rf(slug),
    meta: rfMeta(id, 'musical'),
    ads: 'none',
    site: 'https://www.radiofrance.fr/fip',
  });
}

function fmWeb(slug: string, id: number, name: string, tagline: Localized): Station {
  return station({
    id: slug,
    name,
    line: 'fm',
    country: 'FR',
    tagline,
    streams: rf(slug),
    meta: rfMeta(id, 'musical'),
    ads: 'none',
    site: 'https://www.radiofrance.fr/francemusique',
  });
}

const RTL_SHORT =
  'https://live.m6radio.quortex.io/webM89Hc99XApzgfhXNX8ASN5/grouprtl/national/short/audio-64000/index.m3u8';
const RTL_LONG =
  'https://live.m6radio.quortex.io/webpHJPXnXrN7B6J7Q8mcqmxP/grouprtl/national/long/audio-64000/index.m3u8';

export const catalog: readonly Station[] = [
  // Ligne 1 — Radio France
  station({
    id: 'franceinter',
    name: 'France Inter',
    line: 'rf',
    country: 'FR',
    tagline: t('Info, culture et humour', 'News, culture and comedy'),
    streams: rf('franceinter'),
    meta: rfMeta(1, 'inter'),
    ads: 'onair',
    site: 'https://www.radiofrance.fr/franceinter',
  }),
  station({
    id: 'franceinfo',
    name: 'franceinfo',
    line: 'rf',
    country: 'FR',
    tagline: t('L’info en continu', 'Rolling news'),
    streams: rf('franceinfo'),
    meta: rfMeta(2, 'info'),
    ads: 'onair',
    site: 'https://www.radiofrance.fr/franceinfo',
  }),
  station({
    id: 'franceculture',
    name: 'France Culture',
    line: 'rf',
    country: 'FR',
    tagline: t('Savoirs, débats et fictions', 'Ideas, debate and drama'),
    streams: rf('franceculture'),
    meta: rfMeta(5, 'culture'),
    ads: 'onair',
    site: 'https://www.radiofrance.fr/franceculture',
  }),
  station({
    id: 'francemusique',
    name: 'France Musique',
    line: 'rf',
    country: 'FR',
    tagline: t('Classique, jazz et concerts', 'Classical, jazz and concerts'),
    streams: rf('francemusique'),
    meta: rfMeta(4, 'musique'),
    ads: 'onair',
    site: 'https://www.radiofrance.fr/francemusique',
  }),
  station({
    id: 'fip',
    name: 'FIP',
    line: 'rf',
    country: 'FR',
    tagline: t('Éclectique, peu de paroles', 'Eclectic, little talk'),
    streams: rf('fip'),
    meta: rfMeta(7, 'musical'),
    ads: 'none',
    site: 'https://www.radiofrance.fr/fip',
  }),
  station({
    id: 'mouv',
    name: 'Mouv’',
    line: 'rf',
    country: 'FR',
    tagline: t('Rap et nouvelles scènes', 'Rap and new scenes'),
    streams: rf('mouv'),
    meta: rfMeta(6, 'mouv'),
    ads: 'onair',
    site: 'https://www.radiofrance.fr/mouv',
  }),
  station({
    id: 'iciparis',
    name: 'ici Paris',
    line: 'rf',
    country: 'FR',
    tagline: t('La locale d’Île-de-France', 'Paris local radio'),
    streams: rf('fb1071'),
    meta: rfMeta(68, 'bleu_direct'),
    ads: 'onair',
    site: 'https://www.radiofrance.fr/ici/paris-ile-de-france',
  }),

  // Ligne 2 — FIP
  fipWeb('fiprock', 64, 'FIP Rock', t('Le rock d’hier et d’aujourd’hui', 'Rock, then and now')),
  fipWeb('fipjazz', 65, 'FIP Jazz', t('Tout le jazz', 'Every shade of jazz')),
  fipWeb('fipgroove', 66, 'FIP Groove', t('Soul, funk et groove', 'Soul, funk and groove')),
  fipWeb('fipworld', 69, 'FIP Monde', t('Musiques du monde', 'World music')),
  fipWeb('fipnouveautes', 70, 'FIP Nouveautés', t('Les sorties du moment', 'New releases')),
  fipWeb('fipreggae', 71, 'FIP Reggae', t('Reggae, dub et ska', 'Reggae, dub and ska')),
  fipWeb('fipelectro', 74, 'FIP Electro', t('Électro de tous horizons', 'Electronic music')),
  fipWeb('fipmetal', 77, 'FIP Metal', t('Le metal sous toutes ses formes', 'Metal in all its forms')),
  fipWeb('fippop', 78, 'FIP Pop', t('La pop d’ici et d’ailleurs', 'Pop from everywhere')),
  fipWeb('fiphiphop', 95, 'FIP Hip-Hop', t('Le hip-hop, hier et aujourd’hui', 'Hip-hop, past and present')),
  fipWeb('fipsacrefrancais', 96, 'FIP Sacré français !', t('La chanson française', 'French songs')),
  fipWeb('fipcultes', 709, 'FIP Cultes', t('Les titres devenus cultes', 'Cult classics')),

  // Ligne 3 — France Musique
  fmWeb('francemusiquelajazz', 405, 'La Jazz', t('Le jazz de France Musique', 'Jazz from France Musique')),
  fmWeb('francemusiquebaroque', 408, 'La Baroque', t('Aux origines de la musique', 'Early and baroque music')),
  fmWeb('francemusiquepianozen', 410, 'Piano Zen', t('Piano apaisé', 'Calm piano')),
  fmWeb('francemusiqueeasyclassique', 401, 'Classique Easy', t('Le classique en douceur', 'Gentle classical')),
  fmWeb('francemusiqueopera', 409, 'Opéra', t('Airs et grandes voix', 'Arias and great voices')),
  fmWeb('francemusiqueocoramonde', 404, 'Ocora Musiques du monde', t('Traditions du monde entier', 'Traditional music')),
  fmWeb('francemusiqueclassiqueplus', 402, 'Classique Plus', t('Tout le répertoire', 'The whole repertoire')),
  fmWeb(
    'francemusiqueconcertsradiofrance',
    403,
    'Concerts Radio France',
    t('Les orchestres de Radio France', 'Radio France orchestras'),
  ),
  fmWeb('francemusiquelacontemporaine', 406, 'La Contemporaine', t('La création d’aujourd’hui', 'Contemporary music')),

  // Ligne 4 — Info & débats
  station({
    id: 'rtl',
    name: 'RTL',
    line: 'info',
    country: 'FR',
    tagline: t('Info et divertissement, rembobinage 4 h', 'News and entertainment, 4 h rewind'),
    // The Quortex HLS feed is the broadcast signal: no extra ads, 4 hours of rewind.
    // RTL's Icecast stream inserts its own ads, so it is deliberately left out.
    streams: [hls(RTL_SHORT, 'HE-AAC', 64), hls(RTL_LONG, 'HE-AAC', 64)],
    timeshift: { url: RTL_LONG, window: 4 * 3600 },
    ads: 'onair',
    site: 'https://www.rtl.fr',
  }),
  station({
    id: 'europe1',
    name: 'Europe 1',
    line: 'info',
    country: 'FR',
    tagline: t('Info et débats', 'News and debate'),
    streams: [
      hls('https://europe1.lmn.fm/europe1-live/playlist.m3u8', 'AAC', 128),
      icy('https://stream.europe1.fr/europe1.aac', 'AAC', 128),
      icy('https://stream.europe1.fr/europe1.mp3', 'MP3', 128),
    ],
    ads: 'stream',
    site: 'https://www.europe1.fr',
  }),
  station({
    id: 'courtoisie',
    name: 'Radio Courtoisie',
    line: 'info',
    country: 'FR',
    tagline: t('Débats et libre antenne', 'Talk and debate'),
    streams: [icy('https://ice.creacast.com/radio-courtoisie', 'MP3', 128)],
    ads: 'none',
    site: 'https://www.radiocourtoisie.fr',
  }),
  station({
    id: 'rfi',
    name: 'RFI Monde',
    line: 'info',
    country: 'FR',
    tagline: t('L’actualité internationale', 'International news in French'),
    streams: [icy('https://rfimonde64k.ice.infomaniak.ch/rfimonde-64.mp3', 'MP3', 64)],
    ads: 'unknown',
    site: 'https://www.rfi.fr',
  }),

  // Ligne 5 — Jazz & classique
  station({
    id: 'tsfjazz',
    name: 'TSF Jazz',
    line: 'jazz',
    country: 'FR',
    tagline: t('Le jazz à Paris', 'Jazz from Paris'),
    streams: [icy('https://tsfjazz.ice.infomaniak.ch/tsfjazz-high.mp3', 'MP3', 128)],
    ads: 'onair',
    site: 'https://www.tsfjazz.com',
  }),
  station({
    id: 'swissjazz',
    name: 'Radio Swiss Jazz',
    line: 'jazz',
    country: 'CH',
    tagline: t('Jazz, soul et blues en continu', 'Jazz, soul and blues, non-stop'),
    streams: [icy('https://stream.srg-ssr.ch/srgssr/rsj/aac/96', 'AAC', 96)],
    ads: 'none',
    site: 'https://www.radioswissjazz.ch',
  }),
  station({
    id: 'jazz24',
    name: 'Jazz24',
    line: 'jazz',
    country: 'US',
    tagline: t('Le jazz de Seattle', 'Jazz from Seattle'),
    streams: [
      icy('https://knkx-live-a.edge.audiocdn.com/6285_256k', 'AAC', 256),
      icy('https://knkx-live-a.edge.audiocdn.com/6285_64k', 'AAC', 64, 'eco'),
    ],
    ads: 'onair',
    site: 'https://www.jazz24.org',
  }),
  station({
    id: 'wwoz',
    name: 'WWOZ',
    line: 'jazz',
    country: 'US',
    tagline: t('Jazz et musiques de La Nouvelle-Orléans', 'New Orleans jazz and heritage'),
    streams: [icy('https://wwoz-sc.streamguys1.com/wwoz-hi.mp3', 'MP3', 128)],
    ads: 'onair',
    site: 'https://www.wwoz.org',
  }),
  station({
    id: 'swissclassic',
    name: 'Radio Swiss Classic',
    line: 'jazz',
    country: 'CH',
    tagline: t('Le classique en continu', 'Classical, non-stop'),
    streams: [icy('https://stream.srg-ssr.ch/srgssr/rsc_fr/aac/96', 'AAC', 96)],
    ads: 'none',
    site: 'https://www.radioswissclassic.ch',
  }),
  station({
    id: 'brklassik',
    name: 'BR-Klassik',
    line: 'jazz',
    country: 'DE',
    tagline: t('Le classique depuis Munich', 'Classical from Munich'),
    streams: [
      icy('https://dispatcher.rndfnk.com/br/brklassik/live/mp3/high', 'MP3', 256),
      icy('https://dispatcher.rndfnk.com/br/brklassik/live/mp3/mid', 'MP3', 128, 'eco'),
    ],
    ads: 'none',
    site: 'https://www.br-klassik.de',
  }),
  station({
    id: 'veniceclassic',
    name: 'Venice Classic Radio',
    line: 'jazz',
    country: 'IT',
    tagline: t('Classique et baroque depuis Venise', 'Classical and baroque from Venice'),
    streams: [icy('https://uk2.streamingpulse.com/ssl/vcr1', 'MP3', 128)],
    ads: 'unknown',
    site: 'https://www.veniceclassicradio.eu',
  }),

  // Ligne 6 — Monde
  station({
    id: 'radioparadise',
    name: 'Radio Paradise',
    line: 'monde',
    country: 'US',
    tagline: t('Éclectique, financée par ses auditeurs', 'Eclectic, listener-supported'),
    streams: [
      icy('https://stream.radioparadise.com/aac-320', 'AAC', 320),
      icy('https://stream.radioparadise.com/aac-128', 'AAC', 128, 'eco'),
    ],
    ads: 'none',
    site: 'https://radioparadise.com',
  }),
  station({
    id: 'rpmellow',
    name: 'Radio Paradise Mellow',
    line: 'monde',
    country: 'US',
    tagline: t('Le versant calme de Radio Paradise', 'The mellow side of Radio Paradise'),
    streams: [
      icy('https://stream.radioparadise.com/mellow-320', 'AAC', 320),
      icy('https://stream.radioparadise.com/mellow-128', 'AAC', 128, 'eco'),
    ],
    ads: 'none',
    site: 'https://radioparadise.com',
  }),
  station({
    id: 'kexp',
    name: 'KEXP',
    line: 'monde',
    country: 'US',
    tagline: t('Indépendante, depuis Seattle', 'Independent, from Seattle'),
    streams: [
      icy('https://kexp.streamguys1.com/kexp160.aac', 'AAC', 160),
      icy('https://kexp.streamguys1.com/kexp64.aac', 'AAC', 64, 'eco'),
    ],
    meta: { kind: 'kexp' },
    ads: 'onair',
    site: 'https://www.kexp.org',
  }),
  station({
    id: 'nts1',
    name: 'NTS 1',
    line: 'monde',
    country: 'GB',
    tagline: t('Radio libre depuis Londres', 'Free-form radio from London'),
    streams: [icy('https://stream-relay-geo.ntslive.net/stream', 'MP3', 256)],
    meta: { kind: 'nts', channel: '1' },
    ads: 'unknown',
    site: 'https://www.nts.live',
  }),
  station({
    id: 'nts2',
    name: 'NTS 2',
    line: 'monde',
    country: 'GB',
    tagline: t('Radio libre depuis Londres', 'Free-form radio from London'),
    streams: [icy('https://stream-relay-geo.ntslive.net/stream2', 'MP3', 256)],
    meta: { kind: 'nts', channel: '2' },
    ads: 'unknown',
    site: 'https://www.nts.live',
  }),
  station({
    id: 'bbc6music',
    name: 'BBC Radio 6 Music',
    line: 'monde',
    country: 'GB',
    tagline: t('Musiques alternatives', 'Alternative music'),
    streams: [
      hls(
        'https://as-hls-ww-live.akamaized.net/pool_81827798/live/ww/bbc_6music/bbc_6music.isml/bbc_6music-audio%3d320000.norewind.m3u8',
        'AAC',
        320,
      ),
      hls(
        'https://as-hls-ww-live.akamaized.net/pool_81827798/live/ww/bbc_6music/bbc_6music.isml/bbc_6music-audio%3d96000.norewind.m3u8',
        'AAC',
        96,
        'eco',
      ),
    ],
    ads: 'none',
    site: 'https://www.bbc.co.uk/6music',
  }),
  ...(
    [
      ['groovesalad', 'Groove Salad', t('Ambient et downtempo', 'Ambient and downtempo')],
      ['dronezone', 'Drone Zone', t('Ambient atmosphérique', 'Atmospheric ambient')],
      ['secretagent', 'Secret Agent', t('Lounge d’espionnage', 'Spy lounge')],
      ['lush', 'Lush', t('Voix douces, électronique feutrée', 'Mellow vocals and electronica')],
    ] as const
  ).map(([channel, name, tagline]) =>
    station({
      id: `soma-${channel}`,
      name: `SomaFM ${name}`,
      line: 'monde',
      country: 'US',
      tagline,
      streams: [icy(`https://ice2.somafm.com/${channel}-128-aac`, 'AAC', 128)],
      meta: { kind: 'somafm', channel },
      ads: 'none',
      site: `https://somafm.com/${channel}/`,
    }),
  ),
];

export const defaultFavorites: readonly string[] = [
  'franceinter',
  'franceinfo',
  'franceculture',
  'fip',
  'rtl',
  'europe1',
  'courtoisie',
  'radioparadise',
];
