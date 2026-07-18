# streamingfree

Freely is a responsive streaming-discovery web app focused exclusively on legal, free animation, Korean, and Japanese content.

## Features

- Animation, Korean, and Japanese discovery lanes
- Automatically loaded visual artwork
- Daily automatic catalog updates from official Muse Asia, Korean Film Archive, and JFF Theater sources
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

1. Reads official YouTube RSS feeds and the current JFF Theater catalog.
2. Discovers new animation, Korean, and Japanese titles.
3. Requires an English subtitle/dub signal from the official title, caption track, or JFF title page.
4. Rechecks existing direct links and hides unavailable titles from the app.
5. Commits the refreshed `catalog-data.js` back to `main` using `github-actions[bot]`.

Run the same updater locally with:

```bash
npm run update-catalog
```

If a provider is temporarily unreachable, the updater keeps the last known-good state instead of deleting the catalog.
