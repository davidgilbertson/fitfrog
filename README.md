# Exercise tracker

A small, browser-only version of the desktop exercise log: square green toggles, exercises across the top, newest days first, and daily notes on the right. It is a separate project; the Python apps in `../misc` and `../poser` are unchanged.

## Use

Click or tap a square to mark an exercise done; tap again to undo. Open a day's notes to write in a roomy dialog, then Save. Open **Exercises** to rename, add, move up/down, or delete exercises. Changes in either dialog apply only when you Save; Cancel and Escape discard the draft. Deletion can be undone before saving. Saving an exercise deletion permanently removes that exercise's checkmarks, but keeps daily notes and other exercises.

In an exercise name field, **Shift+Enter** adds and focuses a new row. In notes, **Enter** saves and **Shift+Enter** inserts a new line.

The first visit starts with today plus seven empty past days and one exercise named **Exercise**, ready to rename. Intentionally deleting every exercise leaves an empty list; it does not recreate the starter. Exercise IDs survive renaming and reordering, preserving the history.

The date updates every ten seconds while open, and immediately when the page becomes visible or regains focus. After sleep, the current day appears and missing days remain blank. Dates use the device's local timezone, including daylight-saving changes. The latest 35 days are rendered initially as history grows; **Earlier days** reveals more without deleting anything.

## Phones and larger screens

1. Desktop keeps the familiar dark grid, 52px square targets, large type, and full dates in a monospace font.
2. At 700px and below, dates show the day name and day/month, with 44px square touch targets. The full date remains available to assistive technology and in the notes dialog.
3. Notes use the remaining width. Desktop notes columns at least 320px wide preserve line breaks and wrap text; other text previews use ` ↵ ` for line breaks. If fewer than roughly six characters plus padding would fit, notes become an icon; a brighter icon means the day has a note. All presentations open the same editor.
4. With many exercises, scroll the grid horizontally. Date and notes columns stay at the edges; headings stay visible when scrolling vertically. Targets never shrink to cram in more columns.
5. Reordering uses up/down buttons in the management dialog, so it works with touch and keyboards without drag-and-drop complications.
6. Vertical exercise headings size naturally to the longest name, without a fixed height or truncation.

Designed for phone widths from 375px upward. Today has a subtle green highlight, and phone editors give each exercise name a full-width field above its controls. The page respects screen safe areas and browser zoom remains enabled.

## Storage and privacy

The log is JSON in `localStorage`, under `exercise-tracker.v1`. There are no app accounts, database, API calls, analytics, external fonts, or third-party runtime dependencies. Each person gets an independent log in their own browser.

Storage belongs to the site's exact origin: protocol, hostname and port. A different browser, phone, deployment URL, or localhost port has a separate log. Clearing browser/site data removes it, and private browsing is not a durable place to keep it. There is no device sync or backup/export UI in this version. Stick to one stable URL for actual use.

Edits read the latest stored log before saving, and other tabs update via the storage event. An open note or exercise dialog detects changes to the same content in another tab instead of silently replacing them. Simultaneous edits in multiple tabs are not a fully transactional database; one active editing tab is recommended. Storage errors remain visible and malformed saved data is not silently overwritten.

The optional, feature-detected WebMCP integration exposes a read-only `read_exercise_log` tool to a supporting browser agent. Ordinary browsers require no extension and work without it.

## Develop locally

Requires Node 22 or newer. There is no install or build step and no framework.

```powershell
pnpm dev
```

This serves `dist/` at `http://localhost:42187`. If the server is already running, reuse it. On David's machine the existing static server also serves [the app](http://localhost:22222/dev/exercise-tracker/dist/).

```powershell
pnpm check
pnpm test
```

`dist/` contains the authored, tracked site assets (it is not disposable generated output). `model.js` owns date and log operations, `storage.js` browser persistence, `grid.js` the table and sizing, `dialogs.js` the two editing dialogs, and `app.js` application wiring. `styles.css` holds the plain CSS. Tests cover initial state, stable exercise IDs, deletion, date boundaries and invalid data.

## Deploy to Codex Sites

This is a static Site. `.openai/hosting.json` identifies the registered Site and sets `static.directory` to `dist`. Publish through Codex's Sites workflow from this repository; no secrets, database bindings, migrations or build are needed. Do not create a second Site for later updates: retain its ID and stable URL so browser logs remain attached to the same origin.

The site is public: anyone with its URL can use it. Sharing the site does not share anyone's browser-local log. Keep the local preview as development data, since it is separate from the hosted log.

## Deliberately left out

Counts, targets, suggested exercises, login/sync, install/offline caching, and backup/import are not part of this first version. The app can remain open, but reloading it still needs the site to be reachable. These can be discussed separately if useful.
