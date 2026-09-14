import test from 'node:test';
import assert from 'node:assert/strict';
import {createLog, dateKey, shiftDate, historyDates, setDone, updateExercises, validateLog} from '../src/model.js';

test('first use is today plus seven empty past days', () => {
  const log = createLog('2026-09-14');
  assert.deepEqual(historyDates(log, '2026-09-14'), ['2026-09-14','2026-09-13','2026-09-12','2026-09-11','2026-09-10','2026-09-09','2026-09-08','2026-09-07']);
  assert.equal(log.exercises.length, 1);
  assert.deepEqual(log.days, {});
});

test('renaming and reordering retain history; deleting only removes that exercise', () => {
  const log = createLog('2026-09-14');
  log.exercises = [{id: 'a', name: 'Walk'}, {id: 'b', name: 'Squats'}];
  setDone(log, '2026-09-14', 'a', true);
  setDone(log, '2026-09-14', 'b', true);
  log.days['2026-09-14'].notes = 'Test note';
  updateExercises(log, [{id: 'b', name: 'Squats'}, {id: 'a', name: 'Walking'}]);
  assert.deepEqual(log.days['2026-09-14'].done, ['a', 'b']);
  updateExercises(log, [{id: 'a', name: 'Walking'}]);
  assert.deepEqual(log.days['2026-09-14'], {done: ['a'], notes: 'Test note'});
  updateExercises(log, []);
  assert.deepEqual(log.exercises, []);
  assert.deepEqual(validateLog(JSON.parse(JSON.stringify(log))).exercises, []);
});

test('toggle is idempotent and undone without touching notes', () => {
  const log = createLog('2026-09-14');
  const id = log.exercises[0].id;
  setDone(log, '2026-09-14', id, true);
  setDone(log, '2026-09-14', id, true);
  assert.deepEqual(log.days['2026-09-14'].done, [id]);
  setDone(log, '2026-09-14', id, false);
  assert.deepEqual(log.days['2026-09-14'].done, []);
  assert.throws(() => setDone(log, '2026-09-14', 'missing', true));
});

test('dates cross month, year, and local daylight-saving boundaries', () => {
  assert.equal(shiftDate('2026-01-01', -1), '2025-12-31');
  assert.equal(shiftDate('2024-03-01', -1), '2024-02-29');
  assert.equal(shiftDate('2026-10-04', 1), '2026-10-05');
  assert.equal(dateKey(new Date(2026, 8, 14, 0, 1)), '2026-09-14');
  const log = createLog('2026-09-14');
  setDone(log, '2026-09-14', log.exercises[0].id, true);
  assert.equal(historyDates(log, '2026-09-17')[0], '2026-09-17');
  assert.equal(historyDates(log, '2026-09-17').length, 11);
  assert.equal(log.days['2026-09-14'].done.length, 1);
});

test('bad data and duplicate or empty names fail without silent reset', () => {
  assert.throws(() => validateLog({}));
  assert.throws(() => validateLog({...createLog(), startDate: '2026-02-31'}));
  const log = createLog();
  assert.throws(() => updateExercises(log, [{id:'a', name:' '} ]));
  assert.throws(() => updateExercises(log, [{id:'a', name:'Walk'}, {id:'b', name:' walk '} ]));
});
