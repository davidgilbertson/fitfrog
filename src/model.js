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

export function historyDates(log, today = dateKey(), limit = Infinity) {
  const result = [];
  for (let day = today; day >= log.startDate && result.length < limit; day = shiftDate(day, -1)) result.push(day);
  return result;
}

export function setDone(log, day, exerciseId, done, now = new Date()) {
  if (!log.exercises.some(exercise => exercise.id === exerciseId)) throw new Error('Exercise no longer exists.');
  const entry = log.days[day] ??= {done: [], notes: ''};
  entry.done = entry.done.filter(id => id !== exerciseId);
  if (done) entry.done.push(exerciseId);
  if (done && day === dateKey(now)) (entry.completedAt ??= {})[exerciseId] = now.toISOString();
  if (!done && entry.completedAt) delete entry.completedAt[exerciseId];
}

export function todayExercises(log, today, sort = 'smart') {
  const remaining = log.exercises.filter(exercise => !log.days[today]?.done.includes(exercise.id));
  if (sort === 'columns') return [remaining];
  const daysSince = daysSinceLastDone(log, today);
  // Never completed exercises lead; ties retain column order.
  const oldestFirst = (a, b) => (daysSince.get(b.id) ?? Infinity) - (daysSince.get(a.id) ?? Infinity);
  if (sort === 'oldest') return [remaining.sort(oldestFirst)];

  const lastCompleted = new Map();
  const firstDone = new Map();
  const recentCounts = new Map();
  const weekStart = shiftDate(today, -7);
  for (const [day, entry] of Object.entries(log.days)) {
    // Today's ticks must not change the daily classification of unfinished exercises.
    if (day >= today) continue;
    for (const id of new Set(entry.done)) {
      if (!firstDone.has(id) || day < firstDone.get(id)) firstDone.set(id, day);
      if (day >= weekStart) recentCounts.set(id, (recentCounts.get(id) ?? 0) + 1);
      const at = entry.completedAt?.[id];
      if (at && (!lastCompleted.has(id) || at > lastCompleted.get(id))) lastCompleted.set(id, at);
    }
  }
  const timeOfDay = exercise => {
    const at = lastCompleted.get(exercise.id);
    if (!at) return Infinity;
    const date = new Date(at);
    return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
  };
  const isDaily = exercise => {
    const first = firstDone.get(exercise.id);
    if (!first) return false;
    const days = Math.min(7, (Date.parse(today) - Date.parse(first)) / 86_400_000);
    return (recentCounts.get(exercise.id) ?? 0) >= Math.max(1, days - 1);
  };
  // Stable sorting leaves unknown times and equal times in column order.
  return [
    remaining.filter(isDaily).sort((a, b) => timeOfDay(a) - timeOfDay(b)),
    remaining.filter(exercise => !isDaily(exercise)).sort(oldestFirst),
  ];
}

export function daysSinceLastDone(log, today) {
  const lastDone = new Map();
  for (const [day, entry] of Object.entries(log.days)) {
    if (day > today) continue;
    for (const id of entry.done) {
      if (!lastDone.has(id) || day > lastDone.get(id)) lastDone.set(id, day);
    }
  }
  // Date-only strings parse as UTC, so daylight-saving changes don't shorten or lengthen a day.
  return new Map([...lastDone].map(([id, day]) => [id, (Date.parse(today) - Date.parse(day)) / 86_400_000]));
}

// Conflict resolution is deliberately limited to ticks under this exact date key.
export function mergeTodayTicks(log, otherLog, today) {
  const otherDone = otherLog.days[today]?.done ?? [];
  const ids = new Set(log.exercises.map(exercise => exercise.id));
  const done = [...new Set([...(log.days[today]?.done ?? []), ...otherDone])].filter(id => ids.has(id));
  if (!done.length) return;
  const entry = log.days[today] ??= {done: [], notes: ''};
  entry.done = done;
  for (const id of done) {
    const otherAt = otherLog.days[today]?.completedAt?.[id];
    if (otherAt && (!entry.completedAt?.[id] || otherAt > entry.completedAt[id])) (entry.completedAt ??= {})[id] = otherAt;
  }
}

export function updateExercises(log, exercises) {
  const cleaned = exercises.map(({id, name}) => ({id, name: name.trim()}));
  if (cleaned.some(exercise => !exercise.name)) throw new Error('Give each exercise a name.');
  const names = cleaned.map(exercise => exercise.name.toLocaleLowerCase());
  if (new Set(names).size !== names.length) throw new Error('Use a different name for each exercise.');
  const ids = new Set(cleaned.map(exercise => exercise.id));
  log.exercises = cleaned;
  for (const day of Object.values(log.days)) {
    day.done = day.done.filter(id => ids.has(id));
    if (day.completedAt) for (const id of Object.keys(day.completedAt)) if (!ids.has(id)) delete day.completedAt[id];
  }
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
    if (entry.completedAt !== undefined && (!entry.completedAt || typeof entry.completedAt !== 'object' || Array.isArray(entry.completedAt) || Object.entries(entry.completedAt).some(([id, at]) => !ids.has(id) || typeof at !== 'string' || !Number.isFinite(Date.parse(at))))) throw new Error('The saved completion times could not be read.');
  }
  return log;
}
