# Fit Frog

A small web version of the desktop exercise log: square green toggles, exercises across the top, newest days first, and daily notes on the right. Deployed to https://fitfrog.dgapps.io as a Cloudflare Worker. It is a separate project; the Python apps in `../misc` and `../poser` are unchanged.

## Use

Click or tap a square to mark an exercise done; tap again to undo. Open a day's notes to write in a roomy dialog, then Save. Open **Settings** to rename, add, move up/down, or delete exercises. Changes in either dialog apply only when you Save; Cancel and Escape discard the draft. Deletion can be undone before saving. Saving an exercise deletion permanently removes that exercise's checkmarks, but keeps daily notes and other exercises.

In an exercise name field, **Shift+Enter** adds and focuses a new row. In notes, **Enter** saves and **Shift+Enter** inserts a new line.

The first visit starts with today plus seven empty past days and one exercise named **Exercise**, ready to rename. Intentionally deleting every exercise leaves an empty list; it does not recreate the starter. Exercise IDs survive renaming and reordering, preserving the history.

The date updates every ten seconds while open, and immediately when the page becomes visible or regains focus. After sleep, the current day appears and missing days remain blank. Dates use the device's local timezone, including daylight-saving changes. The latest 90 days are rendered; **Show all days** renders the whole history until the next page load. Nothing is ever deleted.

## Phones and larger screens

1. Desktop keeps the familiar dark grid, 52px square targets, large type, and full dates in a monospace font.
2. At 700px and below, dates show the day name and day/month, with 44px square touch targets. The full date remains available to assistive technology and in the notes dialog.
3. Notes use the remaining width. Desktop notes columns at least 320px wide preserve line breaks and wrap text; other text previews use ` ↵ ` for line breaks. If fewer than roughly six characters plus padding would fit, notes become an icon; a brighter icon means the day has a note. All presentations open the same editor.
4. With many exercises, scroll the grid horizontally. Date and notes columns stay at the edges; headings stay visible when scrolling vertically. Targets never shrink to cram in more columns.
5. Reordering uses up/down buttons in the management dialog, so it works with touch and keyboards without drag-and-drop complications.
6. Vertical exercise headings size naturally to the longest name, without a fixed height or truncation.

Designed for phone widths from 375px upward. Today has a subtle green highlight, and phone editors give each exercise name a full-width field above its controls. The page respects screen safe areas and browser zoom remains enabled.

## Storage, sync and the link-as-login

There are no accounts. On first visit the browser generates a random 12-character ID (`[a-z0-9]`, about 62 bits) and keeps it in `localStorage`. That ID is the key for the log in a Durable Object on Cloudflare, and it is the only credential: **Settings → Use on another device** shows a link containing the ID, and opening that link in any browser replaces that browser's log with the linked one. Anyone with the link can read and edit the log, so it should be treated like a username and password. This is a deliberately low-security design for an app used by one or two people whose data is not sensitive; there is no PII in the log.

The UI reads and writes `localStorage` synchronously, so the app works offline. After each change the whole log is pushed to the server in the background (debounced). On load, focus, visibility change and coming online, the app fetches the server copy and adopts it if its `savedAt` is newer, or pushes the local one if older. This is whole-log last-write-wins with no merging: editing on two devices at the same time, or making offline edits on one device while another device also edits, keeps only the most recent save. One active device at a time is the intended use.

A link with an ID the server doesn't recognise (typically a partially copied link) shows a message and leaves the browser's own log alone. Opening a link while offline also shows a message and leaves the URL in place so a reload can retry.

The server (`worker/index.js`) is a dumb store: one Durable Object per ID holding `{savedAt, log}`, with `GET`/`PUT /api/log/:id`. Validation lives in the client (`validateLog`). Other tabs in the same browser update via the `storage` event, and an open dialog detects changes to the same content in another tab instead of silently replacing them.

The optional, feature-detected WebMCP integration exposes a read-only `read_exercise_log` tool to a supporting browser agent. Ordinary browsers require no extension and work without it.

## Develop locally

Requires Node 22 or newer and pnpm. Vite serves `index.html` and `src/`, and the Cloudflare Vite plugin runs the Worker and Durable Object locally (state under `.wrangler/`).

```powershell
pnpm dev
```

This serves the app at `http://localhost:8098` and on the LAN, so a phone on the same network can test the device link. If the server is already running (e.g. via Cockpit), reuse it.

```powershell
pnpm test
```

## Deploy

```powershell
pnpm deploy
```

That runs `vite build` (hashed assets under `dist/client/assets`, cached immutably via `public/_headers`; `vite-plugin-pwa` generates `manifest.webmanifest` and a Workbox service worker `sw.js` that precaches everything so the app installs and loads offline, and `_headers` marks `sw.js` `no-cache` so a new deploy is picked up on the next visit) and then `wrangler deploy`, which picks up the config the Vite plugin wrote to `dist/fitfrog/`. Pushes to `main` also deploy through `.github/workflows/deploy.yml`, which needs the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repo secrets.
