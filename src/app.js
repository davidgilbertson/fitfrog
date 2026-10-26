import {dateKey, historyDates, setDone} from './model.js';
import {loadLog, saveLog, sync, adoptId, LOG_KEY} from './storage.js';
import {renderGrid, fitGrid} from './grid.js';
import {setupDialogs} from './dialogs.js';
import {renderToday} from './today.js';
import {registerSW} from 'virtual:pwa-register';

const region = document.querySelector('#grid-region');
const historyHeader = document.querySelector('#history-header');
const table = document.querySelector('#tracker');
const todaySection = document.querySelector('#today-section');
const error = document.querySelector('#storage-error');
let log;
let today = dateKey();
const TODAY_SORT_KEY = 'fitfrog-today-sort';
let todaySort;
// Only a rendering cap; the whole log is always loaded. Show all resets on the next page load.
let showAll = false;

// Both surfaces accept horizontal swipes, including the headings while stuck.
region.addEventListener('scroll', () => {historyHeader.scrollLeft = region.scrollLeft;});
historyHeader.addEventListener('scroll', () => {region.scrollLeft = historyHeader.scrollLeft;});

// The browser re-fetches sw.js on every load; when a new build is found, Workbox precaches the new
// files, activates, and the plugin reloads the page. Show a note while that happens.
registerSW({
  immediate: true,
  onRegisteredSW(_, registration) {
    registration.addEventListener('updatefound', () => {
      // updatefound also fires on the very first install, when nothing is controlling the page yet.
      if (navigator.serviceWorker.controller) document.querySelector('#update-banner').hidden = false;
    });
  },
});

function showError(target, message) {
  target.textContent = message;
  target.hidden = false;
}

// Read the latest stored log before editing so another tab's changes are retained.
function commit(change, errorTarget = error) {
  try {
    const next = loadLog();
    change(next);
    saveLog(next);
    log = next;
    errorTarget.hidden = true;
    error.hidden = true;
    return true;
  } catch (cause) {
    showError(errorTarget, cause.name === 'QuotaExceededError' || cause.name === 'SecurityError' ? 'Could not save in this browser. Your change has not been saved.' : cause.message);
    return false;
  }
}

function render() {
  const limit = showAll ? Infinity : 90;
  renderGrid(table, log, today, limit);
  renderToday(todaySection, log, today, todaySort);
  fitGrid(region, table, log.exercises.length);
  const dates = historyDates(log, today, limit);
  document.querySelector('#show-all').hidden = dates.length === 0 || dates.at(-1) <= log.startDate;
}

// A link from Settings carries ?id=; it replaces this browser's own log. The rare failure cases
// (a mangled link, or opening it while offline) just get a message.
const linkedId = new URL(location.href).searchParams.get('id');
if (linkedId) {
  try {
    if (!(await adoptId(linkedId))) showError(error, 'That link’s ID isn’t recognised. Check the whole link was copied. Showing this browser’s own log instead.');
    history.replaceState(null, '', location.pathname);
  } catch (cause) {
    showError(error, `Couldn’t load the linked log (${cause.message}). Check your connection and reload.`);
  }
}

try {
  log = loadLog();
  const savedSort = localStorage.getItem(TODAY_SORT_KEY);
  todaySort = ['smart', 'oldest', 'columns'].includes(savedSort) ? savedSort : 'smart';
  render();
  const openNotes = setupDialogs(() => log, commit, render);
  todaySection.addEventListener('click', event => {
    const button = event.target.closest('button[data-today-sort]');
    if (!button) return;
    try {
      localStorage.setItem(TODAY_SORT_KEY, button.dataset.todaySort);
      todaySort = button.dataset.todaySort;
      refreshDate();
      renderToday(todaySection, log, today, todaySort);
    } catch (cause) {showError(error, `Could not save your sort preference. ${cause.message}`);}
  });
  todaySection.addEventListener('change', event => {
    const checkbox = event.target.closest('input[data-exercise]');
    if (!checkbox) return;
    refreshDate();
    if (commit(next => setDone(next, today, checkbox.dataset.exercise, true))) render();
    else checkbox.checked = false;
  });
  table.addEventListener('click', event => {
    // After sleep, the row still labelled Today belongs to the current day, not yesterday.
    const displayedToday = today;
    const dateChanged = dateKey() !== today;
    refreshDate();
    const toggle = event.target.closest('button[data-exercise]');
    if (toggle) {
      const {exercise} = toggle.dataset;
      const day = toggle.dataset.day === displayedToday ? today : toggle.dataset.day;
      const done = dateChanged ? !(log.days[day]?.done.includes(exercise) ?? false) : toggle.getAttribute('aria-pressed') !== 'true';
      if (commit(next => setDone(next, day, exercise, done))) {
        if (dateChanged) render();
        else {
          toggle.setAttribute('aria-pressed', String(done));
          renderToday(todaySection, log, today, todaySort);
        }
      }
    }
    const note = event.target.closest('button[data-notes-day]');
    if (note) openNotes(note.dataset.notesDay === displayedToday ? today : note.dataset.notesDay);
  });
  document.querySelector('#show-all').addEventListener('click', () => {showAll = true; render();});
  new ResizeObserver(() => fitGrid(region, table, log.exercises.length)).observe(region);

  function refreshDate() {
    if (dateKey() === today) return;
    today = dateKey();
    render();
    window.scrollTo({top: 0});
  }
  // Failures here are expected when offline; the local log is fine and the next sync will catch up.
  async function pull() {
    try {
      if (await sync()) {log = loadLog(); render();}
    } catch (cause) {console.warn('Sync failed', cause);}
  }
  pull();
  setInterval(refreshDate, 10_000);
  document.addEventListener('visibilitychange', () => {if (!document.hidden) {refreshDate(); pull();}});
  window.addEventListener('focus', () => {refreshDate(); pull();});
  window.addEventListener('online', pull);
  window.addEventListener('log-synced', () => {log = loadLog(); render();});
  window.addEventListener('storage', event => {
    if (event.key !== LOG_KEY) return;
    try {log = loadLog(); render();} catch (cause) {showError(error, cause.message);}
  });

  // Optional browser-agent access to the same visible log.
  if (document.modelContext?.registerTool) {
    const lifecycle = new AbortController();
    window.addEventListener('pagehide', () => lifecycle.abort(), {once: true});
    try {
      Promise.resolve(document.modelContext.registerTool({
        name: 'read_exercise_log', title: 'Read exercise log',
        description: 'Read this browser’s exercise list and daily entries. Makes no changes.',
        inputSchema: {type: 'object', properties: {}, additionalProperties: false},
        annotations: {readOnlyHint: true, untrustedContentHint: true},
        execute: () => structuredClone(log),
      }, {signal: lifecycle.signal})).catch(console.warn);
    } catch (cause) {console.warn('Browser-agent tools unavailable', cause);}
  }
} catch (cause) {
  showError(error, `Could not open your saved log. ${cause.message} Nothing has been overwritten.`);
  document.querySelector('#open-settings').disabled = true;
}
