# streamingfree

Freely is a responsive streaming-discovery web app focused exclusively on legal, free animation, Korean, and Japanese content.

## Features

- 100 visible, verified titles in each of the Animation, Korean, and Japanese discovery lanes
- Automatically loaded visual artwork
- MAL rating badges on confidently matched animation titles
- Daily automatic catalog updates from official Muse Asia, Ani-One Asia, Korean Film Archive, KBS World, NHK WORLD-JAPAN, and JFF Theater sources
- New-title discovery limited to entries with verified English subtitles or dubbed audio
- Daily direct-link availability and subtitle-status checks
- Region-aware official platform finder
- Live and premiere channel directory
- Personalized seven-night watchlist generator
- Subtitle finder and viewing toolkit
- Local browser storage for preferences and saved titles

## Run locally

Open `index.html` directly, or start a local server:

```bash
php -S 127.0.0.1:8091
```

Then visit `http://127.0.0.1:8091/`.

The app uses only HTML, CSS, and JavaScript with no build step.

## Automatic catalog updates

The scheduled GitHub Actions workflow runs daily at 02:30 UTC (08:00 IST) on Node.js 24 and can also be started manually from the Actions tab. It:

1. Uses `yt-dlp` to index official Muse Asia and free Ani-One Asia playlists, Korean Film Archive films, KBS World series and full episodes, and NHK WORLD-JAPAN programs, plus the current JFF Theater catalog.
2. Imports up to 100 previously unseen verified titles per refresh; the actual count can be lower when official sources do not have 100 new eligible entries.
3. Maintains 100 visible titles per focus category and rotates newly imported titles into those discovery lanes.
4. Rechecks 100 existing direct links on every run.
5. Requires an English subtitle, dubbed-audio, or English-language signal from the official source.
6. Adds and caches MyAnimeList ratings only when an animation title is a confident public-search match.
7. Hides unavailable titles and clearly marks JFF titles that require a free account.
8. Commits the refreshed `catalog-data.js` back to `main` using `github-actions[bot]`.

Run the same updater locally with:

```bash
npm run update-catalog
```

If a provider is temporarily unreachable, the updater keeps the last known-good state instead of deleting the catalog.
