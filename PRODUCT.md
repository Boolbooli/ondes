# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Bastien, a French listener on iPhone, plus the family members and friends he shares the app with. Everyone listens in all of these situations: at home through speakers or AirPlay, in the car through CarPlay or Bluetooth, on the move with earphones, and in bed while falling asleep or waking up. They come to the app to start a station quickly and hear the whole program without interruptions. They are not hunting through a giant catalog.

## Product Purpose

Ondes is a live radio player that installs on the iPhone home screen. It covers French talk and public radio (Radio France stations, RTL, Europe 1, Radio Courtoisie) and a curated set of international music stations. The app itself never cuts a program to show an ad. Success means one tap from the home screen to sound, a stream that keeps playing through network changes and the lock screen, and an app that is easy to install, share and maintain.

## Positioning

Ondes adds nothing between the listener and the broadcast. There is no app advertising, account, tracking or backend. For each station it picks the cleanest official stream. For example, RTL plays from its ad-free HLS feed instead of the Icecast feed that inserts AdsWizz ads, and RTL can be rewound up to 4 hours. Where a broadcaster puts ads into the stream itself, as Europe 1 does on every endpoint, Ondes says so plainly rather than pretending to block them.

## Operating Context

- Installed from Safari via Share, then "Add to Home Screen", and opened full screen like a native app.
- Controlled as often from the lock screen, Control Center, CarPlay's Now Playing screen, AirPods and AirPlay as from the app itself.
- Used one-handed while walking, at a glance in the car, and in the dark in bed.
- Shared with family through a link. They need to install it without help.
- Maintained by Bastien with little effort. A scheduled check flags dead stream URLs.

## Capabilities and Constraints

- Live radio only. Pause and rewind work where the station allows it: RTL has a 4-hour window, and other stations resume at the live edge. Replays and podcasts are out of scope.
- Station sources:
  - a curated catalog;
  - search through the open Radio Browser directory;
  - adding a stream by URL, including M3U and PLS playlists.
- Features: favorites, sleep timer, stream quality (high or data saver), light and dark themes, and French or English.
- "What's on air" appears only where the broadcaster publishes an open, CORS-enabled feed: Radio France, KEXP, SomaFM and NTS. A web app cannot read in-stream ICY metadata, so other stations show the station identity.
- Web platform limits:
  - no CarPlay app interface, only Now Playing;
  - no programmatic volume control on iOS;
  - streams must be HTTPS.
- Europe 1's in-stream ads cannot be removed by any player.
- Hosting: GitHub Pages on the user's personal GitHub account, deployed by GitHub Actions after the checks pass. A weekly workflow checks every station's streams.

## Brand Commitments

- "Ondes" is the working name.
- French-first interface, with English available.
- Voice: plain, calm and honest. No hype, no upsells, no badges or counters competing for attention.
- The app must never feel busy or commercial like the ad-funded radio apps it replaces. The user named this as the result that would feel most wrong.
- Station artwork is authored typography and color, not official broadcaster logos.

## Evidence on Hand

- Verified stream endpoints and ad behavior for every catalog station, from HTTP probes of redirect chains, HLS playlists and ICY headers.
- Real now-playing API responses in `tests/fixtures/`: Radio France (song and show variants), KEXP, SomaFM and NTS.
- Not on hand, and not to be invented: testimonials, listener numbers, ratings, press, or any claim of ad blocking.

## Product Principles

1. **Never interrupt.** Nothing the app does may cut, cover or delay the broadcast.
2. **One tap to sound.** The last station and favorites are always one tap away, and every main control is reachable with a thumb.
3. **Tell the truth about the stream.** Say where ads come from and what can or cannot be rewound.
4. **Calm, not commercial.** The interface steps back while listening. Station identity and the program carry the color.
5. **Low maintenance.** Static hosting, fallback streams per station, automatic reconnection and scheduled checks keep the app working without attention.

## Accessibility & Inclusion

- Family users of varied ages and technical comfort (assumed, not confirmed).
- Use large tap targets and legible type that respects the iOS text size setting.
- Provide full VoiceOver labels and states.
- Honor reduced motion and reduced transparency.
- Keep contrast sufficient in both themes and in the dark.
