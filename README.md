# Fit Frog

A small web exercise log: exercises across the top, one row per day (newest first), a square toggle per exercise, and daily notes. It's a web version of the desktop exercise log in `../misc`. Deployed to https://fitfrog.dgapps.io as a Cloudflare Worker.

Above the history, Today lists unfinished exercises: those skipped yesterday first, then those completed yesterday, separated by a subtle divider. Each group sorts by the time of day of the latest recorded completion, followed by exercises without recorded times in column order. Ticking either view updates both; completed exercises disappear from Today. Completion times are recorded from now on for current-day ticks, not retrospective history edits.

Design for a 375×667 phone first; desktop just gets more room. Nothing is ever deleted from the log; deleting an exercise removes its checkmarks but keeps notes and history. There's an optional, feature-detected WebMCP tool (`read_exercise_log` in `src/app.js`) for browsers with a built-in agent.

## Storage, sync and the link-as-login

There are no accounts. On first visit the browser generates a random ID and keeps it in `localStorage`. That ID is the key for the log in a Durable Object on Cloudflare, and it is the only credential: Settings shows a link containing the ID, and opening that link in any browser replaces that browser's log with the linked one. Anyone with the link can read and edit the log. This is a deliberately low-security design for an app used by one or two people whose data is not sensitive.

The UI reads and writes `localStorage` synchronously, so the app works offline. After each change the whole log is pushed to the server (debounced), along with the version last received from the server and the browser's existing local date key for today. The server reads the stored log and checks that version in the same transaction as the write. If another device has saved in between, it combines only today's checkboxes: a tick on either device wins. Older days, notes and exercise settings retain the incoming save's values. Ordinary unticking works; unticking during a conflict can be overridden by the other device's tick. The saved result is returned to the client and displayed immediately.

On load, focus, visibility change and coming online, the app fetches the server copy and adopts it if its save time has changed. Pending local edits are tracked with a separate flag and pushed instead so they can be merged on the server. The server (`worker/index.js`) uses one Durable Object per ID holding `{savedAt, log}` and assigns `savedAt` using its own clock; the client does not generate or increment save timestamps. Validation lives in the client. Day entries are matched by their exact date keys, so a stale device missing today's entry can still retain the other device's ticks for today. The server does no date or timezone conversion.

The date refreshes before grid clicks as well as on focus and periodically. If a sleeping tab still labels yesterday's row Today, a click on that row applies to the current day; clicks on older dated rows keep their original dates.

## Develop locally

Requires Node 22+ and pnpm. Vite serves the client and the Cloudflare Vite plugin runs the Worker and Durable Object locally (state under `.wrangler/`).

```powershell
pnpm dev
```

Serves at `http://localhost:8098` and on the LAN so a phone can test the device link. If the server is already running (e.g. via Cockpit), reuse it.

```powershell
pnpm test
```

## Deploy

```powershell
pnpm deploy
```

Pushes to `main` also deploy via `.github/workflows/deploy.yml`, which needs the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repo secrets. The app is an installable PWA (`vite-plugin-pwa`) that precaches everything and auto-updates on the next visit after a deploy.
