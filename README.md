# Overlay Music

Independent, local-first music overlay for OBS. The first implementation reads playback metadata from YouTube and YouTube Music in Chrome/Edge and displays it in a compact, transparent browser source.

## Features

- Compact 520 × 110 transparent overlay.
- Track title, channel/artist, artwork, playback state, progress and animated equalizer.
- Local bridge bound to `127.0.0.1`; track state is held in memory and is not sent to a hosted backend.
- Chrome/Edge Manifest V3 extension for YouTube and YouTube Music.
- Token-protected local endpoint for metadata updates.
- Demo preview that works without a connected music tab.

## Requirements

- Node.js 18 or newer.
- Chrome or Edge.
- OBS on the same computer.

## Run the local bridge

From the repository root:

```bash
npm start
```

On first launch, the bridge generates a random token and saves it to `.music-bridge-token`. The token is excluded from Git. Copy the token printed in the terminal.

The local server listens only on `127.0.0.1:4317`.

## Install the browser extension

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select the repository's `extension` folder.
5. Open the extension's **Options** page.
6. Paste the token printed by the local bridge and save.

Play a video or a song in YouTube / YouTube Music. The extension sends playback metadata only; it does not capture or transmit audio.

## Add it to OBS

Create a **Browser Source** with:

- URL: `http://127.0.0.1:4317/overlay`
- Width: `520`
- Height: `110`

The page background is transparent. The card hides when there is no recent playback state.

For a design preview, open:

```text
http://127.0.0.1:4317/overlay?demo=1
```

Keep the terminal process running while the overlay is in use. Stop it with `Ctrl+C`.

## Run the smoke test

With Node.js 18 or newer, run:

```bash
npm test
```

The smoke test starts the local bridge on a temporary port and checks the overlay assets, authentication, playback-state update, state retrieval, CORS preflight and source validation. It does not need OBS or a YouTube login.

## Spotify compatibility

Spotify's current Developer Policy prohibits building products integrated with streams or content from another service and prohibits non-interactive internet webcasting use cases. An OBS stream overlay is exactly the kind of use that needs careful policy review. For that reason, this version does **not** connect to Spotify's API or scrape the Spotify desktop/web player, and does not claim that such use is permitted.

Official policy references:

- [Spotify Developer Policy](https://developer.spotify.com/policy) — especially section III (prohibited applications).
- [Spotify Design & Branding Guidelines](https://developer.spotify.com/documentation/design) — attribution, metadata, artwork and playing-view requirements.
- [Spotify Developer Terms](https://developer.spotify.com/terms).

The overlay display is source-agnostic, so another supported source can be added without changing the OBS display component.

## Project layout

```text
overlay-music/
├── server.mjs
├── overlay.html
├── overlay.css
├── overlay.js
├── package.json
├── .gitignore
└── extension/
    ├── manifest.json
    ├── content.js
    ├── background.js
    ├── options.html
    └── options.js
```
