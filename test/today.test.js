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

const groupIds = (log, sort) => todayExercises(log, today, sort).map(group => group.map(exercise => exercise.id));

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

test('smart sort puts new daily exercises first and removes completed exercises', () => {
  const log = logWithExercises();
  log.days[yesterday] = {done: ['a', 'c'], notes: ''};
  assert.deepEqual(groupIds(log), [['a', 'c'], ['b', 'd', 'e']]);
  setDone(log, today, 'b', true, now);
  setDone(log, today, 'a', true, now);
  assert.deepEqual(groupIds(log), [['c'], ['d', 'e']]);
  setDone(log, today, 'a', false, now);
  assert.deepEqual(groupIds(log), [['a', 'c'], ['d', 'e']]);
});

test('daily exercises sort by latest completion time of day, with unknown times last', () => {
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
  assert.deepEqual(groupIds(log), [['a', 'd', 'b', 'c'], ['e']]);
});

test('daily detection uses six distinct days in the previous week, excluding today and the future', () => {
  const log = logWithExercises();
  log.days[shiftDate(today, -20)] = {done: ['a', 'b', 'c', 'd'], notes: ''};
  for (let days = 1; days <= 7; days++) {
    log.days[shiftDate(today, -days)] = {done: [
      ...(days <= 6 ? ['a'] : []),
      ...(days >= 2 ? ['b'] : []),
      ...(days <= 5 ? ['c'] : []),
      ...(days === 1 ? ['d', 'd', 'd', 'd', 'd', 'd'] : []),
    ], notes: ''};
  }
  log.days[shiftDate(today, 1)] = {done: ['c'], notes: ''};
  assert.deepEqual(groupIds(log), [['a', 'b'], ['e', 'c', 'd']]);
  setDone(log, today, 'c', true, now);
  assert.deepEqual(groupIds(log), [['a', 'b'], ['e', 'd']]);
});

test('new daily exercises may miss one day, but old exercises do not reset their first completion', () => {
  const log = logWithExercises();
  log.days[shiftDate(today, -20)] = {done: ['d'], notes: ''};
  log.days[shiftDate(today, -4)] = {done: ['a', 'b', 'd'], notes: ''};
  log.days[shiftDate(today, -3)] = {done: ['a'], notes: ''};
  log.days[yesterday] = {done: ['a', 'b', 'c', 'd'], notes: ''};
  assert.deepEqual(groupIds(log), [['a', 'c'], ['e', 'b', 'd']]);
});

test('oldest first uses calendar recency across all history, with never first and no divider', () => {
  const log = logWithExercises();
  log.days[shiftDate(today, -30)] = {done: ['c'], notes: ''};
  log.days[shiftDate(today, -3)] = {done: ['b', 'd'], notes: ''};
  log.days[yesterday] = {done: ['a'], notes: ''};
  log.days[shiftDate(today, 1)] = {done: ['c', 'e'], notes: ''};
  assert.deepEqual(groupIds(log, 'oldest'), [['e', 'c', 'b', 'd', 'a']]);
  setDone(log, today, 'c', true, now);
  assert.deepEqual(groupIds(log, 'oldest'), [['e', 'b', 'd', 'a']]);
});

test('column sort follows exercise settings, omits completed exercises, and has no divider', () => {
  const log = logWithExercises();
  log.exercises.reverse();
  log.days[yesterday] = {done: ['a', 'c'], notes: ''};
  setDone(log, today, 'd', true, now);
  assert.deepEqual(groupIds(log, 'columns'), [['e', 'c', 'b', 'a']]);
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
  assert.deepEqual(groupIds(log), [[], ['a', 'b', 'c', 'd', 'e']]);
  for (const exercise of log.exercises) setDone(log, today, exercise.id, true, now);
  assert.deepEqual(groupIds(log), [[], []]);
  assert.deepEqual(groupIds(log, 'oldest'), [[]]);
  assert.deepEqual(groupIds(log, 'columns'), [[]]);
  log.exercises = [];
  assert.deepEqual(groupIds(log), [[], []]);
});
