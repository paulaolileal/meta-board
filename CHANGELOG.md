# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
