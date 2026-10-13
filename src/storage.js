import {createLog, dateKey, mergeTodayTicks, validateLog} from './model.js';

// localStorage is the source of truth for the UI (so the app works offline); the server copy is
// kept up to date in the background. The server merges today's ticks on conflicting saves.
export const LOG_KEY = 'fitfrog.log';
const ID_KEY = 'fitfrog.id';
const SAVED_AT_KEY = 'fitfrog.savedAt';
const NEEDS_SAVE_KEY = 'fitfrog.needsSave';

function needsSave() {
  return localStorage.getItem(NEEDS_SAVE_KEY) === 'true';
}

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
  localStorage.setItem(NEEDS_SAVE_KEY, 'true');
  schedulePush();
}

// Debounced so a burst of toggles becomes one request.
let pushTimer;
function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(push, 500);
}

let pushing = false;
async function push() {
  if (pushing) {schedulePush(); return;}
  const id = userId();
  const log = loadLog();
  const sentLog = JSON.stringify(log);
  const today = dateKey();
  const body = JSON.stringify({log, baseSavedAt: Number(localStorage.getItem(SAVED_AT_KEY)), today});
  pushing = true;
  try {
    const response = await fetch(`/api/log/${id}`, {method: 'PUT', headers: {'Content-Type': 'application/json'}, body});
    if (!response.ok) throw new Error(`Save failed (${response.status})`);
    const saved = await response.json();
    if (userId() !== id) return;
    if (localStorage.getItem(LOG_KEY) === sentLog) {
      adopt(saved);
    } else {
      // More clicks happened during the request. Retain them and add only ticks supplied by the server.
      const sentDone = log.days[today]?.done ?? [];
      const addedDone = (saved.log.days[today]?.done ?? []).filter(id => !sentDone.includes(id));
      const next = loadLog();
      mergeTodayTicks(next, {days: {[today]: {done: addedDone}}}, today);
      localStorage.setItem(SAVED_AT_KEY, String(saved.savedAt));
      saveLog(next);
    }
    window.dispatchEvent(new Event('log-synced'));
  } catch (cause) {console.warn('Save failed', cause);}
  finally {pushing = false;}
}

function adopt({log, savedAt}) {
  localStorage.setItem(LOG_KEY, JSON.stringify(validateLog(log)));
  localStorage.setItem(SAVED_AT_KEY, String(savedAt));
  localStorage.setItem(NEEDS_SAVE_KEY, 'false');
}

// Unsent edits are pushed; otherwise adopt a changed server copy. Returns true when the local log changed.
export async function sync() {
  loadLog();
  const savedAt = Number(localStorage.getItem(SAVED_AT_KEY));
  const response = await fetch(`/api/log/${userId()}`);
  const remote = response.status === 404 ? null : await response.json();
  // A focus refresh must not discard unsent clicks; let the server resolve the conflict on save.
  if (needsSave()) {schedulePush(); return false;}
  // A save may have completed while this fetch was outstanding. Its response is more up to date.
  if (Number(localStorage.getItem(SAVED_AT_KEY)) !== savedAt) return false;
  if (remote && remote.savedAt !== savedAt) {
    adopt(remote);
    return true;
  }
  if (!remote) schedulePush();
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
