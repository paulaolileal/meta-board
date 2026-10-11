# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- [TESTE E2E] Marcador de release para forçar conflito em review_to_release.
- Local MCP server (`mcp-server/`, run via stdio — never published or
  hosted) exposing board/card/pending-queue tools to agents outside the
  browser (Claude Desktop, Claude Code, scripts): `board_list_boards`,
  `board_list_fields`, `board_list_cards`, `board_create_card`,
  `board_update_card`, `board_move_card`, `board_archive_card`, and the 5
  pending-item tools. Reuses the app's own `GoogleSheetProvider` unchanged,
  authenticating as a Google Service Account instead of the browser's PKCE
  flow (the spreadsheet must be shared with the service account's email as
  Editor). Configured via a versioned `.mcp.json` at the repo root; secrets
  live only in a gitignored `mcp-server/.env` — see `mcp-server/README.md`
  for setup. Board/field creation is intentionally out of scope for now
  (structural, riskier without the UI's visual supervision).
- Extracted `validateRequiredFields`/`moveCardAndReorder` from
  `CreateCardModal.tsx`/`KanbanBoard.tsx` into
  `src/modules/board/domain/cardRules.ts` (same behavior, now testable and
  reused by the new MCP server's `board_create_card`/`board_move_card`
  tools instead of re-implementing the same validation/reorder logic).
- `E2E_TEST_HAPPY_PATH.md` marker file validating the branch-per-card
  agentic flow end to end (card 9/9 of the "Fluxo agêntico maduro" plan).
  [TESTE E2E] edição do lado release para forçar conflito review_to_release.
  [TESTE E2E] edição do lado review para forçar conflito review_to_release.

## [2026-09-08]

### Added

- Per-field instruction (help text): each field in "Editar board" now has an
  expandable "Instrução" textarea (available for every field type, not just
  selectable ones) explaining what should be filled in — shown as a help
  icon with a tooltip next to the field label when opening a card. Existing
  spreadsheets are migrated automatically the first time a board is opened
  (self-healing `_fields` header), no manual action required. The
  instruction is also passed to the AI extraction prompts (manual import and
  automatic batch flow) as a per-field hint, helping the model understand
  what belongs in ambiguous fields.
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
  After extraction, it now also runs the same web-search enrichment step as
  the manual flow's "buscar" button, filling fields the text extraction
  missed. Extraction now reports a 0-100 confidence per field; a field is
  only sent to search (and potentially overwritten) when it's missing or
  its confidence is below 50 — fields extracted with confidence at or above
  that threshold are never re-searched or changed. The "Processamento
  concluído" dialog now lists the actual name of each card created (via the
  board's title field) instead of the original pending item's link/text, and
  clicking a name opens that card directly. The AI extraction step now also
  judges whether the source content has any plausible connection to the
  target board's subject before extracting anything (e.g. a 3D-printing
  tutorial submitted to a tabletop-RPG board) — unrelated items are rejected
  instead of turned into an out-of-place card, left in the pending queue for
  manual review, and shown in the dialog with the AI's stated reason.
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
- Uncaught `TypeError: Cannot read properties of undefined (reading 'sendMessage')` when the
  extension gets reloaded/updated while a MetaBoard tab stays open: the tab's already-injected
  `bridge-content-script.js` loses its connection to the extension (a
  normal Chrome behavior — "extension context invalidated"), and
  `chrome.runtime` reads back `undefined` from then on. The scrape
  request is now wrapped in a `try/catch` that reports a clear
  `EXTENSION_CONTEXT_INVALIDATED` error instead of throwing uncaught, the
  batch loop stops immediately on that error instead of burning through
  `MAX_CONSECUTIVE_FAILURES` retries that would all fail the same way, and
  `isExtensionAvailable()` no longer caches a past "yes" — it always does
  a live ping, so a mid-session invalidation is reflected in the button's
  enabled state on the next check instead of only surfacing once the user
  tries to actually process something.

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
