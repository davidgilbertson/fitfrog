import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {setDone} from '../src/model.js';

// Exercise the real click handler with a sleeping tab; timers/focus events have not refreshed it.
const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const handler = app.slice(app.indexOf("  table.addEventListener('click'"), app.indexOf("  document.querySelector('#show-all').addEventListener"));

test('first click on a stale Today row applies to the new day without changing yesterday', () => {
  const yesterday = '2026-10-12';
  const today = '2026-10-13';
  const log = {exercises: [{id: 'walk', name: 'Walk'}], days: {[yesterday]: {done: ['walk'], notes: 'Keep yesterday'}}};
  const toggle = {dataset: {day: yesterday, exercise: 'walk'}, getAttribute: () => 'true'};
  let click;
  const context = {
    today: yesterday, log, setDone, dateKey: () => today,
    table: {addEventListener: (_, callback) => {click = callback;}},
    refreshDate: () => {context.today = today;},
    commit: change => {change(log); return true;},
    render: () => {},
  };
  runInNewContext(handler, context);
  click({target: {closest: selector => selector === 'button[data-exercise]' ? toggle : null}});
  assert.deepEqual(log.days[today].done, ['walk']);
  assert.deepEqual(log.days[yesterday], {done: ['walk'], notes: 'Keep yesterday'});
});

test('an overnight click on an older row continues to edit that exact date', () => {
  const yesterday = '2026-10-12';
  const earlier = '2026-10-11';
  const log = {exercises: [{id: 'walk', name: 'Walk'}], days: {}};
  const toggle = {dataset: {day: earlier, exercise: 'walk'}};
  let click;
  const context = {
    today: yesterday, log, setDone, dateKey: () => '2026-10-13',
    table: {addEventListener: (_, callback) => {click = callback;}},
    refreshDate: () => {context.today = '2026-10-13';},
    commit: change => {change(log); return true;},
    render: () => {},
  };
  runInNewContext(handler, context);
  click({target: {closest: selector => selector === 'button[data-exercise]' ? toggle : null}});
  assert.deepEqual(log.days[earlier].done, ['walk']);
  assert.equal(log.days['2026-10-13'], undefined);
});
