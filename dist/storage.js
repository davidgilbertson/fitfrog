import {createLog, validateLog} from './model.js';

export const STORAGE_KEY = 'exercise-tracker.v1';

export function loadLog() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved !== null) return validateLog(JSON.parse(saved));
  const log = createLog();
  saveLog(log);
  return log;
}

export function saveLog(log) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
}
