import {dateKey, historyDates, setDone} from './model.js';
import {loadLog, saveLog, STORAGE_KEY} from './storage.js';
import {renderGrid, fitGrid} from './grid.js';
import {setupDialogs} from './dialogs.js';

const region = document.querySelector('#grid-region');
const table = document.querySelector('#tracker');
const error = document.querySelector('#storage-error');
let log;
let today = dateKey();
let historyLimit = 35;

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
  renderGrid(table, log, today, historyLimit);
  fitGrid(region, table, log.exercises.length);
  const dates = historyDates(log, today, historyLimit);
  document.querySelector('#earlier-days').hidden = dates.length === 0 || dates.at(-1) <= log.startDate;
}

try {
  log = loadLog();
  render();
  const openNotes = setupDialogs(() => log, commit, render);
  table.addEventListener('click', event => {
    const toggle = event.target.closest('button[data-exercise]');
    if (toggle) {
      const {day, exercise} = toggle.dataset;
      const done = toggle.getAttribute('aria-pressed') !== 'true';
      if (commit(next => setDone(next, day, exercise, done))) toggle.setAttribute('aria-pressed', String(done));
    }
    const note = event.target.closest('button[data-notes-day]');
    if (note) openNotes(note.dataset.notesDay);
  });
  document.querySelector('#earlier-days').addEventListener('click', () => {historyLimit += 35; render();});
  new ResizeObserver(() => fitGrid(region, table, log.exercises.length)).observe(region);

  function refreshDate() {
    if (dateKey() === today) return;
    today = dateKey();
    render();
    region.scrollTop = 0;
  }
  setInterval(refreshDate, 10_000);
  document.addEventListener('visibilitychange', () => {if (!document.hidden) refreshDate();});
  window.addEventListener('focus', refreshDate);
  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY) return;
    try {log = loadLog(); render();} catch (cause) {showError(error, cause.message);}
  });

  // Optional browser-agent access to the same visible log; no server or account.
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
  document.querySelector('#manage-exercises').disabled = true;
}
