import test from 'node:test';
import assert from 'node:assert/strict';
import {createLog, dateKey, daysSinceLastDone, setDone, shiftDate, todayExercises, updateExercises, validateLog} from '../src/model.js';
import {resolveSave} from '../worker/save.js';

const now = new Date(2026, 9, 22, 10, 30);
const today = dateKey(now);
const yesterday = shiftDate(today, -1);

function logWithExercises() {
  const log = createLog(today);
  log.exercises = ['a', 'b', 'c', 'd', 'e'].map(id => ({id, name: id}));
  return log;
}

const groupIds = log => todayExercises(log, today).map(group => group.map(exercise => exercise.id));

test('days since last done uses all legacy history, ignores future ticks, and counts calendar days', () => {
  const log = logWithExercises();
  log.days['2026-10-02'] = {done: ['a', 'b'], notes: ''};
  log.days['2026-10-04'] = {done: ['a'], notes: ''};
  log.days['2026-10-06'] = {done: ['a', 'c'], notes: ''};
  log.days['2026-10-07'] = {done: ['b'], notes: ''};
  const daysSince = daysSinceLastDone(log, '2026-10-05');
  assert.equal(daysSince.get('a'), 1);
  assert.equal(daysSince.get('b'), 3);
  assert.equal(daysSince.has('c'), false);
  assert.equal(daysSince.has('e'), false);
});

test('legacy ticks group by yesterday and keep column order, including never completed exercises', () => {
  const log = logWithExercises();
  log.days[yesterday] = {done: ['a', 'c'], notes: ''};
  assert.deepEqual(groupIds(log), [['b', 'd', 'e'], ['a', 'c']]);
  setDone(log, today, 'b', true, now);
  setDone(log, today, 'a', true, now);
  assert.deepEqual(groupIds(log), [['d', 'e'], ['c']]);
  setDone(log, today, 'a', false, now);
  assert.deepEqual(groupIds(log), [['d', 'e'], ['a', 'c']]);
});

test('each group sorts by the latest completion time of day, with unknown times last', () => {
  const log = logWithExercises();
  const earlier = shiftDate(today, -2);
  log.days[earlier] = {done: ['b', 'd'], notes: '', completedAt: {
    b: new Date(2026, 9, 20, 6).toISOString(),
    d: new Date(2026, 9, 20, 8).toISOString(),
  }};
  // The latest b completion was at night; don't average or prefer its earlier morning time.
  log.days[yesterday] = {done: ['b', 'a', 'c'], notes: '', completedAt: {
    b: new Date(2026, 9, 21, 21).toISOString(),
    a: new Date(2026, 9, 21, 7).toISOString(),
  }};
  assert.deepEqual(groupIds(log), [['d', 'e'], ['a', 'b', 'c']]);
});

test('only actual current-day completions get timestamps; unticking removes their timestamp', () => {
  const log = logWithExercises();
  setDone(log, today, 'a', true, now);
  setDone(log, yesterday, 'b', true, now);
  assert.equal(log.days[today].completedAt.a, now.toISOString());
  assert.equal(log.days[yesterday].completedAt, undefined);
  assert.deepEqual(validateLog(JSON.parse(JSON.stringify(log))), log);
  setDone(log, today, 'a', false, now);
  assert.equal(log.days[today].completedAt.a, undefined);
  setDone(log, today, 'a', true, now);
  updateExercises(log, log.exercises.filter(exercise => exercise.id !== 'a'));
  assert.equal(log.days[today].completedAt.a, undefined);
});

test('conflicting saves retain completion times with the ticks, choosing the latest for the same exercise', () => {
  const phone = logWithExercises();
  const pc = logWithExercises();
  setDone(phone, today, 'a', true, now);
  setDone(phone, today, 'b', true, now);
  const later = new Date(2026, 9, 22, 18);
  setDone(pc, today, 'a', true, later);
  const saved = resolveSave({savedAt: 2, log: phone}, {log: pc, baseSavedAt: 1, today});
  assert.deepEqual(saved.log.days[today].done, ['a', 'b']);
  assert.deepEqual(saved.log.days[today].completedAt, {a: later.toISOString(), b: now.toISOString()});
});

test('an empty or fully completed log has two empty groups', () => {
  const log = logWithExercises();
  assert.deepEqual(groupIds(log), [['a', 'b', 'c', 'd', 'e'], []]);
  for (const exercise of log.exercises) setDone(log, today, exercise.id, true, now);
  assert.deepEqual(groupIds(log), [[], []]);
  log.exercises = [];
  assert.deepEqual(groupIds(log), [[], []]);
});
