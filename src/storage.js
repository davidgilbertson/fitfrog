import {createLog, validateLog} from './model.js';

// localStorage is the source of truth for the UI (so the app works offline); the server copy is
// kept up to date in the background. Whole-log last-write-wins by savedAt, no merging.
export const LOG_KEY = 'fitfrog.log';
const ID_KEY = 'fitfrog.id';
const SAVED_AT_KEY = 'fitfrog.savedAt';

// The ID is the only credential. 12 chars of [a-z0-9] is ~62 bits: unguessable in practice for an
// app with a handful of users, and short enough to read out loud. The byte % 36 bias doesn't matter here.
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function userId() {
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(12)), byte => ID_ALPHABET[byte % 36]).join('');
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export function loadLog() {
  const saved = localStorage.getItem(LOG_KEY);
  if (saved !== null) return validateLog(JSON.parse(saved));
  const log = createLog();
  saveLog(log);
  return log;
}

export function saveLog(log) {
  localStorage.setItem(LOG_KEY, JSON.stringify(log));
  localStorage.setItem(SAVED_AT_KEY, String(Date.now()));
  schedulePush();
}

// Debounced so a burst of toggles becomes one request.
let pushTimer;
function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(push, 500);
}

function push() {
  const body = JSON.stringify({savedAt: Number(localStorage.getItem(SAVED_AT_KEY)), log: JSON.parse(localStorage.getItem(LOG_KEY))});
  return fetch(`/api/log/${userId()}`, {method: 'PUT', headers: {'Content-Type': 'application/json'}, body}).catch(console.warn);
}

function adopt({log, savedAt}) {
  localStorage.setItem(LOG_KEY, JSON.stringify(validateLog(log)));
  localStorage.setItem(SAVED_AT_KEY, String(savedAt));
}

// Compare with the server copy: adopt it if newer, push ours if older. Returns true when the local log changed.
export async function sync() {
  const response = await fetch(`/api/log/${userId()}`);
  const remote = response.status === 404 ? null : await response.json();
  const savedAt = Number(localStorage.getItem(SAVED_AT_KEY));
  if (remote && remote.savedAt > savedAt) {
    adopt(remote);
    return true;
  }
  if (!remote || remote.savedAt < savedAt) schedulePush();
  return false;
}

// Switch this browser to the log behind a shared link, replacing whatever it had. False when the server doesn't know the ID.
export async function adoptId(id) {
  const response = await fetch(`/api/log/${id}`);
  if (response.status === 404) return false;
  adopt(await response.json());
  localStorage.setItem(ID_KEY, id);
  return true;
}
