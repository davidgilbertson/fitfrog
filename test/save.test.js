import test, {beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {resolveSave} from '../worker/save.js';

const today = '2026-10-13';
beforeEach(t => {t.mock.method(Date, 'now', () => 1000);});
function log(done = []) {
  return {version: 1, startDate: '2026-10-01', exercises: [{id: 'walk', name: 'Walk'}, {id: 'squats', name: 'Squats'}], days: {[today]: {done, notes: 'Incoming note'}}};
}

test('stale PC save retains phone and PC ticks, merging only the supplied day', () => {
  const phone = log(['walk']);
  phone.days[today].notes = 'Phone note';
  phone.days['2026-10-12'] = {done: ['walk'], notes: 'Phone yesterday'};
  phone.days['2026-10-14'] = {done: ['walk'], notes: 'Future entry'};
  const pc = log(['squats']);
  pc.days['2026-10-12'] = {done: ['squats'], notes: 'PC yesterday'};
  const original = structuredClone(pc);
  const saved = resolveSave({savedAt: 200, log: phone}, {savedAt: 300, log: pc, baseSavedAt: 100, today});
  assert.deepEqual(saved.log.days[today], {done: ['squats', 'walk'], notes: 'Incoming note'});
  assert.deepEqual(saved.log.days['2026-10-12'], original.days['2026-10-12']);
  assert.equal(saved.log.days['2026-10-14'], undefined);
  assert.deepEqual(saved.log.exercises, original.exercises);
  assert.equal(saved.savedAt, 1000);
  assert.deepEqual(phone.days[today].done, ['walk']);
});

test('ordinary unticking is retained when the client has the current version', () => {
  const saved = resolveSave({savedAt: 200, log: log(['walk'])}, {savedAt: 300, log: log(), baseSavedAt: 200, today});
  assert.deepEqual(saved.log.days[today].done, []);
});

test('a tick wins over unticking only during a conflict, without duplicates', () => {
  const saved = resolveSave({savedAt: 200, log: log(['walk', 'squats'])}, {savedAt: 300, log: log(['squats']), baseSavedAt: 100, today});
  assert.deepEqual(saved.log.days[today].done, ['squats', 'walk']);
});

test('missing day entries are empty and deleted exercises are not resurrected', () => {
  const pc = log();
  delete pc.days[today];
  pc.exercises = [{id: 'walk', name: 'Walk'}];
  const saved = resolveSave({savedAt: 200, log: log(['walk', 'squats'])}, {savedAt: 300, log: pc, baseSavedAt: 100, today});
  assert.deepEqual(saved.log.days[today], {done: ['walk'], notes: ''});
  const phone = log();
  delete phone.days[today];
  assert.deepEqual(resolveSave({savedAt: 200, log: phone}, {savedAt: 300, log: log(['walk']), baseSavedAt: 100, today}).log.days[today].done, ['walk']);
});

test('new users and older clients can still save', () => {
  assert.deepEqual(resolveSave(null, {savedAt: 100, log: log(['walk']), baseSavedAt: 0, today}).log.days[today].done, ['walk']);
  assert.deepEqual(resolveSave({savedAt: 200, log: log(['walk'])}, {savedAt: 300, log: log(['squats'])}).log.days[today].done, ['squats']);
});

test('save time comes directly from the server clock, ignoring client timestamps', () => {
  const saved = resolveSave({savedAt: 200, log: log(['walk'])}, {savedAt: 100, log: log(['squats']), baseSavedAt: 100, today});
  assert.equal(saved.savedAt, 1000);
  const later = resolveSave({savedAt: 9999, log: log()}, {savedAt: 99999, log: log(['walk']), baseSavedAt: 9999, today});
  assert.equal(later.savedAt, 1000);
});

test('overnight stale log missing today merges the matching date despite different day counts', () => {
  const phone = log(['walk']);
  phone.days['2026-10-12'] = {done: ['walk'], notes: 'Yesterday on phone'};
  phone.days['2026-10-11'] = {done: ['squats'], notes: 'Older phone day'};
  const pc = log();
  delete pc.days[today];
  pc.days['2026-10-12'] = {done: ['squats'], notes: 'Yesterday on PC'};
  const saved = resolveSave({savedAt: 200, log: phone}, {log: pc, baseSavedAt: 100, today});
  assert.deepEqual(saved.log.days[today], {done: ['walk'], notes: ''});
  assert.deepEqual(saved.log.days['2026-10-12'], {done: ['squats'], notes: 'Yesterday on PC'});
});
