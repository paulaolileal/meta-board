# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Batch processing of the pending queue via the Chrome extension: a new
  "Processar automaticamente" button in the pending list opens each pending
  link in a background tab, scrapes it, runs the same AI field extraction
  as the manual import flow, and creates the resulting card(s) — no more
  opening each link by hand and clicking the extension one at a time.
  Failures are skipped without aborting the batch, and the batch auto-stops
  after 3 consecutive failures (likely Instagram rate-limiting). Each
  processable pending item now has a checkbox (defaulting to selected) so
  specific links can be excluded from a run instead of always processing
  the entire queue, plus a "Selecionar todos"/"Limpar seleção" shortcut.
- `_autoCreated` card field: cards created by the batch flow are flagged and
  show a badge ("Automático") until the user opens the card and clicks the
  new "Aprovar" button in the drawer header.
- Per-content-type Instagram extraction in the extension's scraper: posts,
  reels and IGTV now go through dedicated flows instead of one generic one,
  and carousel posts are extracted as an ordered `media` array instead of
  only the first slide.
- Bidirectional app ↔ extension messaging channel
  (`src/modules/board/extensionBridge.ts` +
  `extension/bridge-content-script.js` +
  `extension/background.js`'s new `SCRAPE_URL` handler) — lets the app ask
  the extension to scrape an arbitrary URL and await the result, instead of
  the extension only ever pushing data to the app.

### Changed

- Extension now declares the `https://www.instagram.com/*` host permission
  (`host_permissions`, granted at install time) instead of relying solely
  on `activeTab` — required to open and scrape background tabs the user
  didn't click into directly. Existing unpacked installs need a manual
  reload in `chrome://extensions` to pick this up.

### Fixed

- `extension/manifest.json`'s `content_scripts.matches` was missing
  `http://localhost:8080/*`, the actual dev server port configured in
  `vite.config.ts` (only 5173/3000 were listed) — the bridge content script
  was never injected during local dev, so `isExtensionAvailable()` always
  timed out and the batch-processing button stayed disabled even with the
  extension installed and up to date.
- Batch scraping crashed with "Cannot read properties of undefined
  (reading 'contains')": the first version of the Instagram host
  permission requested it at runtime (`optional_host_permissions` +
  `chrome.permissions.request()`) from `bridge-content-script.js`, but
  `chrome.permissions` isn't available to content scripts at all — only
  to extension pages and the background service worker. Switched to a
  static `host_permissions` grant instead of trying to relocate the
  runtime request (moving it to the background script would have lost
  the user-gesture context `chrome.permissions.request()` requires).
- Batch scraping always failed with "Page did not become ready in time":
  `extension/background.js` injected the readiness-check script right
  after `chrome.tabs.create()`, but that promise resolves as soon as the
  tab exists, before it navigates away from the initial `about:blank` —
  the injected script's context (and the Promise still polling inside
  it) got torn down mid-navigation and never resolved, so every scrape
  timed out regardless of the target page. Now waits for
  `chrome.tabs.onUpdated`'s `status: "complete"` before injecting
  anything. Also relaxed the readiness signal (accepts `<article>`/
  `<video>` in addition to `og:title`/`<time>`, and falls back to "DOM
  finished loading" once out of budget) since a background tab may be
  exactly the case Instagram's own visibility-based lazy hydration delays
  the most, and increased the timeouts to give background tabs more room.

## [2026-08-18]

### Fixed

- Board card background no longer leaves an uncolored gap at the bottom
  when the description is a single line: the inner flex row wrapping the
  colored icon strip and the title/description column now stretches to
  the card's full height (`h-full`), instead of only sizing to its own
  content while the CSS grid stretched the outer card to match the
  tallest sibling in the row.

## [2026-08-14]

### Changed

- Footer LealTEK credit (board list and login screen) now matches Splitout's
  treatment: full-opacity logo (was dimmed to 40% by default), "Conheça a
  LealTEK" hover title, and a "© {year} MetaBoard. Todos os direitos
  reservados." line underneath instead of just the bare logo link.

- Migrated Google authentication from Google Identity Services' implicit
  OAuth2 flow to the shared `lealtek-api` backend (Authorization Code +
  PKCE). Silent renewal now calls `POST /api/auth/refresh` on
  `api.lealtek.com` instead of `requestAccessToken({ prompt: 'none' })`,
  which depended on Google's own third-party session cookie and broke under
  cookie partitioning / installed PWAs. Interactive sign-in is now a
  full-page redirect to `lealtek-api`'s login endpoint instead of a GIS
  popup.
- `OpenAiClient.ts` and `LinkPreviewClient.ts` now call `lealtek-api`
  (`/api/ai/*`, `/api/tools/link-preview`) instead of this app's own
  `/api/openai/*` and `/api/link/preview` routes.

### Added

- In-app-browser detection (`src/shared/auth/inAppBrowser.ts`) shows an
  "open in your browser" prompt instead of the sign-in button when the app
  is opened inside Instagram/Facebook/LinkedIn/etc. — Google rejects OAuth
  inside these webviews regardless of backend architecture, so this is a
  client-side mirror of the same check `lealtek-api` enforces authoritatively
  server-side.

### Removed

- `api/` (the 4 Vercel Functions proxying OpenAI/link-preview and the
  `verifyGoogleAuth` helper) — consolidated into `lealtek-api`, which now
  hosts these routes for all 5 LealTEK apps.
- `VITE_GOOGLE_CLIENT_ID` — no longer needed client-side; the OAuth Client
  ID now only lives server-side in `lealtek-api`. Replaced by
  `VITE_LEALTEK_API_URL`.
