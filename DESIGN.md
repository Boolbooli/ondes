---
name: Ondes
description: "Radio as a métro network: midnight enamel signage, porcelain keylines and line inks, staged as vertical strip maps for a French-first iPhone radio player that nothing cuts into."
colors:
  enamel: "#0b1230"
  porcelain: "#f6f3ec"
  ink-scarlet: "#d93a2b"
  ink-cobalt: "#2f64d6"
  ink-pink: "#c93a82"
  ink-violet: "#8752d6"
  ink-amber: "#f2b01e"
  ink-amber-tile: "#a86e00"
  ink-teal: "#137a8c"
  ink-green: "#23864a"
  ink-slate: "#6b7599"
  amber-soot: "#1a1300"
  signal-amber: "#ffb13b"
  amber-unlit: "#a27838"
  fault-red: "#ff7b66"
  board-black: "#07090f"
  enamel-raised: "#141d45"
  porcelain-haze: "#c3cae4"
  porcelain-dusk: "#9aa4cb"
  enamel-seam: "#26336b"
  danger-coral: "#ff8a7a"
  field: "rgb(246 243 236 / 0.09)"
  hover: "rgb(246 243 236 / 0.06)"
  press: "rgb(246 243 236 / 0.12)"
  scrim: "rgb(3 6 20 / 0.6)"
  tile-wall: "#f3f5f6"
  tile-white: "#ffffff"
  glazed-surface: "#f7f8f8"
  navy-ink: "#121a3a"
  navy-ink-faded: "#3e4770"
  navy-ink-pale: "#535b80"
  tile-joint: "#d5dae0"
  burnt-amber: "#8a5300"
  brick-red: "#b3261e"
  field-tile: "rgb(18 26 58 / 0.06)"
  hover-tile: "rgb(18 26 58 / 0.05)"
  press-tile: "rgb(18 26 58 / 0.1)"
  scrim-tile: "rgb(11 18 48 / 0.42)"
typography:
  display:
    fontFamily: "'Archivo Variable', 'Arial Narrow', system-ui, sans-serif"
    fontSize: 1.75rem
    fontWeight: 800
    lineHeight: 1.1
    fontVariation: "'wdth' 75"
  headline:
    fontFamily: "'Archivo Variable', 'Arial Narrow', system-ui, sans-serif"
    fontSize: 1.375rem
    fontWeight: 800
    lineHeight: 1.1
    fontVariation: "'wdth' 75"
  title:
    fontFamily: "'Archivo Variable', 'Arial Narrow', system-ui, sans-serif"
    fontSize: 1.25rem
    fontWeight: 800
    lineHeight: 1.1
    fontVariation: "'wdth' 75"
  title-sm:
    fontFamily: "'Archivo Variable', 'Arial Narrow', system-ui, sans-serif"
    fontSize: 1.125rem
    fontWeight: 800
    lineHeight: 1.2
    fontVariation: "'wdth' 75"
  station:
    fontFamily: "'Archivo Variable', 'Arial Narrow', system-ui, sans-serif"
    fontSize: 1.1875rem
    fontWeight: 700
    lineHeight: 1.25
    fontVariation: "'wdth' 87.5"
  numeral:
    fontFamily: "'Archivo Variable', 'Arial Narrow', system-ui, sans-serif"
    fontWeight: 750
    fontFeature: "'tnum', 'lnum'"
    fontVariation: "'wdth' 87.5"
  programme:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 1.0625rem
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.4
  body-sm:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 0.9375rem
    fontWeight: 400
    lineHeight: 1.35
  meta:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.25
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 1rem
    fontWeight: 600
  control:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 0.9375rem
    fontWeight: 600
    lineHeight: 1.2
  caption:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 0.8125rem
    fontWeight: 600
    lineHeight: 1.2
  led-board:
    fontFamily: "'Doto Variable', ui-monospace, monospace"
    fontSize: 1.25rem
    fontWeight: 700
    lineHeight: 1.1
  led-chip:
    fontFamily: "'Doto Variable', ui-monospace, monospace"
    fontSize: 0.875rem
    fontWeight: 700
    lineHeight: 1.25
rounded:
  sm: 10px
  md: 12px
  lg: 14px
  xl: 16px
  xxl: 20px
  pill: 999px
  round: 50%
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  gutter: 20px
  xl: 28px
components:
  button-pill:
    backgroundColor: "{colors.porcelain}"
    textColor: "{colors.enamel}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: 0 20px
    height: 44px
  button-pill-tile:
    backgroundColor: "{colors.navy-ink}"
    textColor: "{colors.tile-wall}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: 0 20px
    height: 44px
  button-pill-quiet:
    backgroundColor: "{colors.field}"
    textColor: "{colors.porcelain}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: 0 20px
    height: 44px
  button-pill-live:
    backgroundColor: "{colors.signal-amber}"
    textColor: "{colors.amber-soot}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: 0 20px
    height: 44px
  button-icon:
    backgroundColor: transparent
    textColor: "{colors.porcelain}"
    rounded: "{rounded.round}"
    size: 44px
  button-icon-hover:
    backgroundColor: "{colors.hover}"
  button-icon-active:
    backgroundColor: "{colors.press}"
  button-text:
    backgroundColor: "{colors.field}"
    textColor: "{colors.porcelain}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: 0 16px
    height: 44px
  transport-play:
    backgroundColor: "{colors.porcelain}"
    textColor: "{colors.enamel}"
    rounded: "{rounded.round}"
    size: 76px
  transport-step:
    textColor: "{colors.porcelain}"
    rounded: "{rounded.round}"
    size: 52px
  chip:
    backgroundColor: "{colors.field}"
    textColor: "{colors.porcelain}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: 0 16px
    height: 44px
  chip-quiet:
    backgroundColor: transparent
    textColor: "{colors.porcelain-haze}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: 0 16px
    height: 44px
  input-field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.porcelain}"
    rounded: "{rounded.md}"
    padding: 0 14px
    height: 48px
  input-search:
    backgroundColor: "{colors.field}"
    textColor: "{colors.porcelain}"
    rounded: "{rounded.md}"
    padding: 0 44px 0 40px
    height: "max(44px, 2.6rem)"
  masthead-bar:
    backgroundColor: "{colors.enamel}"
    textColor: "{colors.porcelain}"
    height: 52px
  roundel-xs:
    typography: "{typography.numeral}"
    rounded: "{rounded.round}"
    size: 18px
  roundel-sm:
    typography: "{typography.numeral}"
    rounded: "{rounded.round}"
    size: 24px
  roundel:
    typography: "{typography.numeral}"
    rounded: "{rounded.round}"
    size: 32px
  roundel-lg:
    typography: "{typography.numeral}"
    rounded: "{rounded.round}"
    size: 44px
  map-stop:
    typography: "{typography.station}"
    height: 64px
  map-marker:
    backgroundColor: "{colors.enamel}"
    rounded: "{rounded.round}"
    size: 36px
  dock:
    backgroundColor: "{colors.enamel-raised}"
    textColor: "{colors.porcelain}"
    rounded: "{rounded.xxl}"
    padding: 10px
  board:
    backgroundColor: "{colors.board-black}"
    textColor: "{colors.signal-amber}"
    typography: "{typography.led-board}"
    rounded: 8px
    padding: 8px 14px
  led-chip:
    backgroundColor: "{colors.board-black}"
    textColor: "{colors.signal-amber}"
    typography: "{typography.led-chip}"
    rounded: 4px
  ad-line:
    textColor: "{colors.porcelain-dusk}"
    typography: "{typography.meta}"
  note:
    backgroundColor: "{colors.field}"
    typography: "{typography.meta}"
    rounded: "{rounded.md}"
    padding: 10px 12px
  toast:
    backgroundColor: "{colors.enamel}"
    textColor: "{colors.porcelain}"
    rounded: "{rounded.xl}"
    padding: 12px 12px 12px 16px
  sheet-player:
    backgroundColor: "{colors.enamel}"
    textColor: "{colors.porcelain}"
    rounded: 20px 20px 0 0
  sheet-surface:
    backgroundColor: "{colors.enamel-raised}"
    textColor: "{colors.porcelain}"
    rounded: 20px 20px 0 0
  sheet-surface-tile:
    backgroundColor: "{colors.glazed-surface}"
    textColor: "{colors.navy-ink}"
    rounded: 20px 20px 0 0
---

# Design System: Ondes

## Overview

**Creative North Star: "Plan du métro"**

Ondes draws radio as a métro network. Each station is a stop on an enamel line, each line has its own ink, and a listener finds a station the way a traveller finds a stop: by line, by order, and by what the board says is on now. The first viewport is the network itself. An enamel band carries the wordmark, search, settings and a row of line roundels; below it, the chosen line runs down the screen as a vertical strip map, each stop labelled with its programme; at the bottom sits the enamel plaque of the station on air. Tapping a stop moves the "Vous êtes ici" marker along the line and the sound starts at once.

The materials are those of a Paris station: midnight-blue enamel signage, porcelain keylines and stop rings, saturated line inks, the amber dot-matrix of the platform board and, in the light theme, the white bevelled tile wall. There are two themes. Émail (dark, the default) is enamel throughout. Carrelage (light) retiles the ground of the map pages and the utility sheets with a running-bond tile, while every piece of signage (masthead, dock, player, desktop side panel, toasts) stays enamel.

The system refuses the logo-tile wall of ad-funded radio apps: no grid of broadcaster logos, no promotional chips, no badges, nothing that competes with a station's name and its line. Restraint is the trust signal. The product promises that nothing cuts in, so the interface reads as public infrastructure, not as a shop window.

**Key Characteristics:**
- Navigation by line: a roundel row picks a line, and each line is a vertical strip map on its own horizontally snapping page.
- One travelling marker carries playback state on the map: playing, paused, idle, loading, retrying, error, offline.
- Enamel signage holds in both themes; only the ground is retiled.
- Hue comes only from line inks; amber is reserved for the signal.
- Archivo in two condensed cuts for names, the system face for everything read at length, Doto dot-matrix only on board black.
- Authored station plaques instead of broadcaster logos.
- Flat surfaces; only objects that sit on top of the network cast shadows.
- Native iPhone behaviour: Dynamic Type, 44px targets, safe areas, reduced motion honoured.

## Colors

A signage palette. Two materials, midnight enamel and porcelain, carry every surface and every word; eight line inks carry all of the hue; one amber carries the signal. Interaction washes are the text colour at low alpha, never a new hue.

### Primary
- **Midnight Enamel** (#0b1230): the ground of Émail and of every enamel element in both themes (masthead, player sheet, side panel, toasts), the field of station plaques and of the map marker, the glyph on porcelain discs, and the theme colour of the installed app.
- **Porcelain** (#f6f3ec): text and icons on enamel, the keylines (the dock inset, the plaque frame), stop fills, the play discs, the marker ring and the ring around the selected roundel.

### Secondary
Line inks. Each line owns one, chosen so its roundel numeral holds 4.5:1 and its rail holds 3:1 against enamel and tile.
- **Scarlet Line** (#d93a2b): Ma ligne ★, the listener's own favourites line. Because that line belongs to the listener, scarlet doubles as the brand: the mark, the favourite star, the install-steps line.
- **Cobalt Line** (#2f64d6): line 1, Radio France.
- **Pink Line** (#c93a82): line 2, FIP.
- **Violet Line** (#8752d6): line 3, France Musique.
- **Amber Line** (#f2b01e): line 4, Info & débats. Its numeral is Amber Soot (#1a1300), and on tile it is drawn in Tile Amber (#a86e00).
- **Teal Line** (#137a8c): line 5, Jazz & classique.
- **Green Line** (#23864a): line 6, Monde.
- **Slate Line** (#6b7599): line +, Mes stations, the streams the listener adds.

### Tertiary
The platform board, and the signal it lends to the rest of the app.
- **Signal Amber** (#ffb13b): the lettering of the board and the dock LED chip in both themes, and the Émail signal colour: next-up times, the ad-line and note icons, the loading arc, the back-to-live pill, the timer when armed.
- **Unlit Amber** (#a27838): board lettering when idle or paused (still 4.6:1 on Board Black).
- **Fault Red** (#ff7b66): board lettering on error or offline.
- **Board Black** (#07090f): the platform board, the dock LED chip and the rewind scrub bubble.

### Neutral
Émail, the enamel theme:
- **Raised Enamel** (#141d45): the dock face, and the utility sheets (search, settings) in Émail.
- **Porcelain Haze** (#c3cae4): secondary text, the destination line above the player.
- **Porcelain Dusk** (#9aa4cb): tertiary text, placeholders, the sheet grabber, the ad line.
- **Enamel Seam** (#26336b): 1px rules, the masthead's lower edge, the quiet chip's ring.
- **Danger Coral** (#ff8a7a): destructive actions and error text off the board.
- **Field** (rgb(246 243 236 / 0.09)), **Hover** (rgb(246 243 236 / 0.06)), **Press** (rgb(246 243 236 / 0.12)): the washes behind fields, chips, notes and panels, and their hover and press states. **Scrim** (rgb(3 6 20 / 0.6)) dims the map behind a sheet.

Carrelage, the tile wall:
- **Tile Wall** (#f3f5f6): the ground, under a bevelled running-bond tile pattern (tile faces shading from #f9fafb to #edf0f2, #dce0e3 joints, a white top highlight).
- **Tile White** (#ffffff): stop fills, raised faces and the segmented-control thumb on tile, and the roundel numerals on every ink but amber.
- **Glazed Surface** (#f7f8f8): the utility sheets on tile.
- **Navy Ink** (#121a3a), **Faded Navy** (#3e4770), **Pale Navy** (#535b80): primary, secondary and tertiary text on tile.
- **Tile Joint** (#d5dae0): rules on tile.
- **Burnt Amber** (#8a5300): the signal colour on tile.
- **Brick Red** (#b3261e): danger on tile.
- **Field on Tile** (rgb(18 26 58 / 0.06)), **Hover on Tile** (rgb(18 26 58 / 0.05)), **Press on Tile** (rgb(18 26 58 / 0.1)), **Scrim on Tile** (rgb(11 18 48 / 0.42)): the same washes in navy.

Under `prefers-contrast: more`, secondary text, tertiary text and rules step up (Émail #e3e7f5, #c9cfe6, #4a5a9c; Carrelage #222a4d, #2e3660, #9aa3b5). Under `prefers-reduced-transparency`, the scrims thicken to 0.85 and 0.72 alpha.

### Named Rules
**The Signage Stays Enamel Rule.** The masthead, the dock, the player sheet, the desktop side panel and toasts carry the `.enamel` class and keep Émail colours in both themes. Carrelage retiles only the map pages and the utility sheets. The light theme is a tiled wall with enamel signs on it, never a white app.

**The Line Owns the Ink Rule.** Saturated hue comes only from a line's ink, passed down as `--ink`, `--on-ink` and `--ink-light`; `--line-ink` switches to the tile ink on Carrelage pages. Nothing takes an ink except to say which line it belongs to; scarlet's role as the brand is the one exception.

**The Signal Amber Rule.** Amber is the signal colour of the platform: live state, times, loading, the station's notices (the ad line, notes) and armed controls (back to live, the timer). It is never decoration and never a second brand colour. On tile the signal darkens to Burnt Amber; the board keeps Signal Amber in both themes because the board is always black.

## Typography

**Display Font:** Archivo Variable (with Arial Narrow and system-ui fallbacks), narrowed on its width axis through `font-stretch` (75% and 87.5%) into the condensed transit sans of station names and signage.
**Body Font:** the system UI face (system-ui, -apple-system, Segoe UI, Roboto), so programmes, notes and controls read as the phone's own text.
**Label/Mono Font:** Doto Variable (with a ui-monospace fallback), the amber dot-matrix of the platform board.

**Character:** Names are set like enamel station plates: heavy, narrow and legible at a glance from a moving train. Everything read at length speaks in the phone's own voice. The dot-matrix is a sign, not a typeface for the app.

### Hierarchy
The ramp is compact and rem-based. On touch devices the root takes the iOS body style (`font: -apple-system-body`), so every rem size follows Dynamic Type. Only three sizes are pinned: the wordmark (24px), the smallest roundel numeral (11px) and input text (max(17px, 1rem), which stops iOS from zooming on focus).

- **Display** (Archivo 800, 'wdth' 75, 1.75rem, line height 1.1): the station name in the player, and the line name heading a strip map (uppercase, 1.05).
- **Headline** (Archivo 800, 'wdth' 75, 1.375rem, 1.1): sheet titles and the about name, uppercase.
- **Title** (Archivo 800, 'wdth' 75, 1.25rem, 1.1): directory section titles and index letters.
- **Title Small** (Archivo 800, 'wdth' 75, 1.125rem, 1.2): the station name in the dock; settings group titles (uppercase, 1.1).
- **Station** (Archivo 700, 'wdth' 87.5, 1.1875rem, 1.25): stop names on the strip map; catalogue search results at 1.125rem.
- **Numeral** (Archivo 750, 'wdth' 87.5, tabular lining figures): roundel numerals, sized at 0.56 of the roundel's diameter and never below 11px.
- **Programme** (system 600, 1.0625rem, 1.4): the programme title in the player.
- **Body** (system 400, 1rem, 1.4): running text.
- **Body Small** (system 400, 0.9375rem, 1.35): programmes under stops, counts, hints, station facts, toasts.
- **Meta** (system 400, 0.875rem, 1.25): the dock status, the ad line, notes, result details; field labels at 600.
- **Label** (system 600, 1rem): pill buttons and toast actions.
- **Control** (system 600, 0.9375rem, 1.2): chips, text buttons, segmented options.
- **Caption** (system 600, 0.8125rem, 1.2): the labels under the player's actions.
- **Board** (Doto 700, 1.25rem, 1.1; 1.125rem under 720px tall): the platform board, shrunk to fit its width (clamp(0.75rem, 9.5cqi, var(--led-size))).
- **LED Chip** (Doto 700, 0.875rem, 1.25): the status chip in the dock.

Letter-spacing appears twice: the wordmark (0.04em) and the destination line above the player (0.02em, 0.9375rem Archivo 800 'wdth' 75). Uppercase is always applied by CSS; the DOM keeps sentence case for screen readers and translation.

### Named Rules
**The Two Cuts Rule.** Archivo comes in two cuts. The signage cut (800, 'wdth' 75) names stations and places where they stand alone: the player, the dock, line heads, sheet titles. The stop cut (700, 'wdth' 87.5) sets names that stack in lists and need more air. Roundel numerals sit between them (750, 'wdth' 87.5). Every other word is the system face.

**The Stranger's Name Rule.** Stations from the world directory (radio-browser: unauthored, often foreign) are set in the system face at 600 and normal width, clamped to two lines. Only stations on the network wear the transit cut, so a directory result reads as not yet on a line.

**The Board Is the Only Dot-Matrix Rule.** Doto appears only on Board Black: the player's platform board, the dock LED chip (a miniature of the board, dot grid included) and the rewind scrub bubble. Never on enamel, never on tile.

## Layout

Mobile-first, one column. The masthead bar, the roundel row and page content share a 680px maximum width, with 20px gutters set against the safe areas through max(). Lines are pages: they scroll horizontally with mandatory snap, one line per page, in step with the roundel row. Every page keeps its foot clear for the docked plaque (calc(120px + safe-area-inset-bottom)).

The dock floats over the map: fixed, at most 640px wide, inset max(10px, safe area) from the sides and max(12px, safe area) from the bottom. Sheets rise to 10px below the top safe area; from 640px wide they become a centred card (min(560px, 100% - 32px)). From 1024px wide the app becomes a grid of the map and a 400px enamel side panel that holds the player behind a 1px rule; the dock disappears and toasts move left of the panel.

Spacing steps through 4, 8, 12, 16, 20 (the gutter) and 28px between groups. The player's vertical rhythm is 18 to 22px, tightened to 10 to 14px on short screens.

Breakpoints: compact (max-width 359px) shrinks the transport; sheet card (min-width 640px); short (max-height 720px, the iPhone SE) tightens the player; wide (min-width 1024px) adds the side panel.

### Named Rules
**The Strip Map Rule.** A line is drawn with fixed geometry: an 8px rail in the line's ink on a 28px axis, 18px stop rings with a 3.5px ink border and a porcelain fill (white on tile) centred on the first line of each station name, and stop rows at least 64px tall. Termini trim the rail, and a line with no stations shows a dashed track under construction. The 36px "Vous êtes ici" marker lands on the playing stop (360ms) and the stops it passes light up (420ms).

**The Plaque Gives Way Rule.** The station plaque yields first. Its size is what the viewport leaves after the chrome (min(100%, 340px, max(10rem, 100svh - safe areas - chrome))). The chrome is budgeted in parts (base, text, rewind for timeshift stations, ads), so each optional row reserves only its own height, and every part tightens under 720px tall.

**The Thumb Rule.** Every control is at least 44px on both axes (roundel tabs 44 by 48, fields 48, directory rows 52, stop and action rows 64, actions 56 on short screens), and input text never drops below 17px.

## Elevation & Depth

Flat by default. Lists, fields, sheets and the map are separated by 1px rules and washes, not shadows. Depth belongs to objects that sit on top of the network (the dock plaque, toasts, the station plaque, the play disc) and to the small parts that slide over a track (the rewind knob and its scrub bubble, and the segmented thumb on tile). The board is the one recessed surface. Rings drawn with spread shadows replace borders wherever a shape needs an edge.

### Shadow Vocabulary
- **Plaque lift** (`0 0 0 1px rgb(2 4 16 / 0.7), 0 12px 30px -10px rgb(2 4 16 / 0.6), 0 2px 6px rgb(2 4 16 / 0.3)`): the dock in Émail. A dark edge ring, a long soft drop and a short contact shadow.
- **Plaque lift on tile** (`0 0 0 1px rgb(11 18 48 / 0.5), 0 12px 28px -10px rgb(11 18 48 / 0.45), 0 2px 6px rgb(11 18 48 / 0.18)`): the same plaque on Carrelage, ringed in navy against the tiles.
- **Toast** (`0 0 0 1px rgb(246 243 236 / 0.14), 0 10px 28px -10px rgb(2 4 16 / 0.6)`): a porcelain edge and a drop. On tile it takes the drop and contact shadow of the tile plaque without the ring (`0 12px 28px -10px rgb(11 18 48 / 0.45), 0 2px 6px rgb(11 18 48 / 0.18)`).
- **Plate drop** (`0 18px 40px -16px rgb(0 0 0 / 0.7)`): the station plaque in the player. A loaded photo adds a hairline (`0 0 0 1px rgb(246 243 236 / 0.08)`).
- **Disc drop** (`0 8px 20px -8px rgb(0 0 0 / 0.6)`): the play disc.
- **Knob contact** (`0 0 0 3px` ground, `0 2px 6px rgb(0 0 0 / 0.4)`): the rewind knob, cut out of its track and lifted just off it.
- **Bubble** (`0 0 0 1px rgb(246 243 236 / 0.12), 0 6px 14px -6px rgb(0 0 0 / 0.6)`): the rewind scrub bubble, a porcelain edge and a short drop.
- **Thumb on tile** (`0 1px 3px rgb(11 18 48 / 0.16), 0 0 0 0.5px rgb(11 18 48 / 0.08)`): the segmented-control thumb in Carrelage. In Émail the thumb sits flat.
- **Recess** (`inset 0 1px 3px rgb(0 0 0 / 0.8), 0 0 0 1px rgb(246 243 236 / 0.1)`): the platform board. The LED chip uses a shallower inset (`inset 0 1px 2px rgb(0 0 0 / 0.8)`).
- **Ground halo** (`0 0 0 3px` in the ground colour): cuts the marker, the selected roundel and the timeline knob out of whatever they sit on. The selected roundel adds a porcelain ring outside it (`0 0 0 5.5px`).

### Named Rules
**The Only Objects Cast Rule.** Shadows belong to objects: the dock, toasts, the station plaque and the play disc, plus a short contact shadow under parts that slide (the rewind knob, its scrub bubble, the segmented thumb on tile). Rows, fields, chips, sheets and the map never cast; a sheet shows only a 1px highlight along its top edge.

**The Recessed Board Rule.** The board is set into the player, not stuck on it: an inset shadow and a faint porcelain rim, never a drop shadow.

**The Ground Halo Rule.** Anything that sits on a line or a track (the marker, the selected roundel, the rewind knob) is cut out of it by a 3px ring of the ground colour, the way a métro map separates a station symbol from its line.

## Shapes

One soft radius ladder for rectangles (10, 12, 14, 16, 20px), pills (999px) for buttons and chips, and full circles for everything that is a stop or a disc: roundels, the marker, stop rings, the play and step buttons, icon buttons.

- **10px**: dock artwork and catalogue result rows.
- **12px**: fields, the search field, notes, the segmented control, roundel tabs, the stop highlight, the dock's tap area.
- **14px**: the station plaque in the player, the action buttons, the station facts panel.
- **16px**: toasts, the dock keyline, the add-stream card.
- **20px**: the dock plaque and the top corners of sheets.
- Directory rows stay square so the rules between them run straight. The board (8px), the LED chip (4px) and the scrub bubble (6px) are tighter because they are instruments set into a surface.

### Named Rules
**The Keyline Inset Rule.** An enamel plaque carries a porcelain keyline inset from its edge: 1.5px at 4px inside the dock, concentric at 16px within its 20px corners, and 4 units at 20 units inside the 512-unit station plaque. Photos never get a keyline; a loaded photo gets only an 8% porcelain hairline, and authored plaques are never ringed.

## Components

### Buttons
- **Pill** (`.pill-btn`): filled with the text colour and lettered in the ground colour, so it is porcelain with an enamel label on Émail and navy with a tile label on Carrelage. Label type, 44px tall, 0 20px padding (16px on the side of a leading icon), fully round. Quiet pills use the Field wash; the back-to-live pill is Signal Amber with Amber Soot text; disabled pills drop to 55% opacity.
- **Icon button** (`.icon-btn`): a 44px circle, transparent at rest, the Hover wash on hover, the Press wash and scale 0.92 when pressed, 35% opacity when disabled.
- **Text button** (`.text-btn`): Field wash, Control type, 44px tall, 0 16px padding, pill-shaped. On tile it is white with an inset 1px rule ring. When toggled on, it inverts to the text colour.
- **Transport**: 52px step buttons around a 76px porcelain play disc with an enamel glyph and the disc drop (44px and 68px under 359px wide). While a stream loads, a Signal Amber arc turns around the disc.
- **Press feedback**: every button scales down on press (0.92 to 0.96) within 60ms and returns over 160ms on the Enamel Ease (cubic-bezier(0.16, 1, 0.3, 1)).

### Chips
- **Chip** (`.chip`): Field wash, pill-shaped, 44px tall, 0 16px padding, Control type with tabular figures; the Press wash when pressed.
- **Quiet chip** (`.chip--quiet`): transparent, with an inset 1.5px rule ring and secondary text.

### Cards / Containers
- **Note** (`.note`): Field wash, 12px radius, 10px 12px padding, an 18px info icon in the signal colour, at most 420px wide. It carries a full sentence of context, such as a station that inserts its own ads.
- **Station facts** (Fiche station): a disclosure whose list is a Field panel at 14px radius, rows split by 1px rules, terms in tertiary text.
- **Segmented control**: a Field track with 3px padding and 12px radius around a sliding raised thumb, 38px options for a 44px control; the theme options carry 18px swatches.
- Panels never hold panels. Toasts and sheets are the only enamel or surface containers, and they hold rows, never cards.

### Inputs / Fields
- **Field**: 48px tall, 0 14px padding, 12px radius, Field wash, no border, placeholder in tertiary text, text at max(17px, 1rem).
- **Search field**: max(44px, 2.6rem) tall, with a search glyph inset left in tertiary text and room for a clear button on the right (0 44px 0 40px padding).
- **Focus**: every control shows a 3px solid ring in the text colour at a 2px offset, on `:focus-visible` only.

### Navigation
- **Masthead**: an enamel band in both themes over a 1px seam. Its 52px bar holds the mark (a porcelain stop ring on a scarlet line) and the ONDES wordmark (Archivo 800, 'wdth' 75, 24px, 0.04em), then the search and settings icon buttons; the roundel row runs beneath.
- **Roundel row**: one tab per line, each a 44 by 48 target holding a 32px roundel: a disc of the line's ink with its numeral (or the star of Ma ligne) in the on-ink colour. Unselected roundels rest at scale 0.82; the selected one is full size with a ground halo and a porcelain ring; a press takes it to 0.76 (260ms on the Enamel Ease).
- **Roundel sizes**: 18px in search results, 24px in the player's destination line, 32px in tabs, 44px heading a strip map.

### Strip Map and Marker
The signature component. Stops follow the Strip Map Rule: the name in the Station cut, the programme and its end time beneath in Body Small secondary text. The marker is a 36px disc of the ground colour inside a 3px ring of the text colour, haloed by the ground.
- **Playing**: the core fills with the line's ink.
- **Paused, idle**: an inset 3px ring of ink.
- **Loading, retrying**: two arcs seek around the marker (1.2s linear, repeating until sound starts).
- **Error, offline**: a core in tertiary text colour.
- Under reduced motion the arrival, wake and seek animations stop; the state still reads from the marker's fill.

### Platform Board
The only dot-matrix surface, set into the player under the plaque. A Board Black plate the width of the plaque, at least 44px tall, 8px 14px padding, 8px radius, recessed, with a faint amber dot grid (radial-gradient(circle, rgb(255 177 59 / 0.07) 0 1px, transparent 1.5px) on a 4px pitch). It shows a status word (En direct, uppercased by CSS) and an aside with the end time (→ 01:00), or the delay when listening behind live; a row of dots along its foot fills with programme progress. Lettering is Signal Amber when live, Unlit Amber when idle or paused, Fault Red on error or offline.

### Dock Plaque
A Raised Enamel plaque (20px radius, 10px padding) with the plaque lift and a porcelain keyline 4px inside its edge; on tile the edge ring turns navy. It holds 48px station art (10px radius), the name in Title Small, a status row of the LED chip and the programme title, and a 52px porcelain play disc. It rises in over 420ms and only fades under reduced motion.

### Player
An enamel sheet on phones and the enamel side panel on wide screens. Under a destination line (a 24px roundel and the line name), in order:
- The station plaque at 14px radius, easing to 0.9 scale over 500ms when paused or idle.
- The platform board.
- The station name in Display; the programme title in Programme type, clamped to three lines; then the next programme on one line of secondary text, led by an "À suivre HH:MM" label in the signal colour at 600.
- The ad line: one line of Meta text in tertiary colour behind a 16px signal icon, a check when the station has no ads on air and an info icon otherwise. A station that inserts ads into its stream gets the longer note instead (Europe 1 is named in its own).
- The timeline, for timeshift stations only: a 6px track and a 28px knob in the line's ink with a 4px porcelain border and a ground halo.
- The transport, the actions (three equal columns: Ma ligne, whose star turns scarlet when the station is on it; Minuterie, in the signal colour when armed; Partager) and the station facts.

### Station Plaque
Authored artwork instead of broadcaster logos: a 512-unit SVG on Midnight Enamel with the line's ink rail across its lower part (28 units) and a stop ring on it, a porcelain keyline frame (inset 20, radius 28, stroke 4), the line roundel at top left, and the station name in uppercase Archivo 800 'wdth' 75 in porcelain, fitted to the plate. A programme photo from a now-playing feed may fade in over it (400ms) once loaded.

### Toasts, Sheets and Search
- **Toast**: enamel in both themes, 16px radius, 12px 12px 12px 16px padding, the toast shadow, at most 480px wide and 84px above the dock; its action is a porcelain pill. It rises 12px in over 280ms and leaves over 200ms.
- **Sheet**: rises from the bottom on a spring, 20px top corners, a 36 by 5 grabber in tertiary text at 50% opacity, the title in Headline. The player sheet is enamel; the search and settings sheets follow the theme.
- **Search results**: catalogue rows set names in the Station cut (at 1.125rem) with 18px roundels for their lines; directory rows follow the Stranger's Name Rule, with a Listen button in the Field wash that turns porcelain while it plays.

### Named Rules
**The Never-Empty Board Rule.** The board always shows a station. On first run the first favourite that resolves is docked, idle, one tap from sound.

**The Title-Only Dock Rule.** The dock's status row says what is on (the programme title) and nothing more. The end time belongs to the board and to the stops on the map.

## Do's and Don'ts

### Do:
- **Do** draw every line as a strip map: an 8px ink rail on a 28px axis, 18px stop rings, and one travelling "Vous êtes ici" marker that carries the playback state.
- **Do** pass colour through the line's `--ink`, `--on-ink` and `--line-ink`, so Carrelage pages pick up the tile ink by themselves.
- **Do** keep the masthead, the dock, the player, the desktop side panel and toasts in enamel in both themes.
- **Do** keep the board populated: on first run, dock the first favourite that resolves, idle, one tap from sound.
- **Do** state the ad status under every programme: a check when the station has no ads on air, an info icon and a short status when it carries the ads heard on FM, and the longer note only for a station that inserts ads into its stream.
- **Do** give every press a scale-down within 60ms and a 160ms return on the Enamel Ease (cubic-bezier(0.16, 1, 0.3, 1)).
- **Do** keep every control at least 44px and input text at least 17px, and set type in rem so it follows Dynamic Type.
- **Do** keep the dock's status to the programme title; the end time belongs to the board and the map.

### Don't:
- **Don't** put coloured side stripes thicker than 1px on rows, cards, notes or toasts. The line rail, the stop rings and the install-steps line are the network itself, drawn as a track, and stay legal.
- **Don't** use gradient text, glows, bloom or text-shadow; lettering is flat ink on enamel, tile or board.
- **Don't** nest cards: a wash panel never holds another wash panel.
- **Don't** put eyebrow or kicker labels above headings. The uppercase words of the board and the LED chip are platform signage, not kickers.
- **Don't** set text below 11px, and don't put em dashes in copy.
- **Don't** animate layout properties (width, height, padding, margins, position offsets) or use bounce or elastic easing. Motion runs on scale, translate, rotate, opacity, colour and shadow.
- **Don't** run infinite motion except to show a live loading state (the spinner arc around the play disc, the seeking marker), and don't ignore `prefers-reduced-motion`.
- **Don't** use the dot-matrix face anywhere but on Board Black, and don't set directory names in the transit cut.
- **Don't** ring or frame authored plaques; only a loaded photo gets the hairline.
- **Don't** lay stations out as a wall of logo tiles or use broadcaster logos as station art.
- **Don't** add badges, counters or promotional chips beside a station name; the only mark next to a name is its line roundel.
