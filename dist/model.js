export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dateFromKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function shiftDate(key, days) {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

export function createLog(today = dateKey()) {
  return {version: 1, startDate: shiftDate(today, -7), exercises: [{id: crypto.randomUUID(), name: 'Exercise'}], days: {}};
}

export function historyDates(log, today = dateKey(), limit = 35) {
  const result = [];
  for (let day = today; day >= log.startDate && result.length < limit; day = shiftDate(day, -1)) result.push(day);
  return result;
}

export function setDone(log, day, exerciseId, done) {
  if (!log.exercises.some(exercise => exercise.id === exerciseId)) throw new Error('Exercise no longer exists.');
  const entry = log.days[day] ??= {done: [], notes: ''};
  entry.done = entry.done.filter(id => id !== exerciseId);
  if (done) entry.done.push(exerciseId);
}

export function updateExercises(log, exercises) {
  const cleaned = exercises.map(({id, name}) => ({id, name: name.trim()}));
  if (cleaned.some(exercise => !exercise.name)) throw new Error('Give each exercise a name.');
  const names = cleaned.map(exercise => exercise.name.toLocaleLowerCase());
  if (new Set(names).size !== names.length) throw new Error('Use a different name for each exercise.');
  const ids = new Set(cleaned.map(exercise => exercise.id));
  log.exercises = cleaned;
  for (const day of Object.values(log.days)) day.done = day.done.filter(id => ids.has(id));
}

export function validateLog(log) {
  if (log?.version !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(log.startDate) || !Array.isArray(log.exercises) || !log.days || typeof log.days !== 'object' || Array.isArray(log.days)) throw new Error('The saved log could not be read. Your stored data has not been changed.');
  if (dateKey(dateFromKey(log.startDate)) !== log.startDate) throw new Error('The saved start date is invalid.');
  const ids = new Set();
  for (const exercise of log.exercises) {
    if (typeof exercise.id !== 'string' || typeof exercise.name !== 'string' || ids.has(exercise.id)) throw new Error('The saved exercise list could not be read.');
    ids.add(exercise.id);
  }
  for (const [day, entry] of Object.entries(log.days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Array.isArray(entry?.done) || typeof entry.notes !== 'string' || entry.done.some(id => !ids.has(id))) throw new Error('The saved daily entries could not be read.');
  }
  return log;
}
