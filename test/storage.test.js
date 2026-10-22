import test, {beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {dateKey, shiftDate} from '../src/model.js';
import {loadLog, saveLog, sync, adoptId} from '../src/storage.js';
import {resolveSave} from '../worker/save.js';

let pendingPush;
let server;
let clock;
let updates;
let requests;
const today = dateKey();
function log(done = []) {
  return {version: 1, startDate: today, exercises: [{id: 'walk', name: 'Walk'}, {id: 'squats', name: 'Squats'}], days: {[today]: {done, notes: ''}}};
}

beforeEach(t => {
  const values = new Map();
  // Replace Node's native localStorage getter without invoking it (it needs a backing file).
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)}});
  globalThis.window = new EventTarget();
  t.after(() => {
    if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
    else delete globalThis.localStorage;
    delete globalThis.window;
  });
  const setTimer = globalThis.setTimeout;
  const clearTimer = globalThis.clearTimeout;
  const pushTimer = Symbol('push timer');
  t.mock.method(globalThis, 'setTimeout', (callback, ...args) => {
    if (callback.name !== 'push') return setTimer(callback, ...args);
    pendingPush = callback;
    return pushTimer;
  });
  t.mock.method(globalThis, 'clearTimeout', timer => {
    if (timer === pushTimer) pendingPush = null;
    else clearTimer(timer);
  });
  clock = 100;
  updates = 0;
  requests = [];
  window.addEventListener('log-synced', () => updates++);
  t.mock.method(Date, 'now', () => ++clock);
  server = {savedAt: 100, log: log()};
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (options?.method === 'PUT') {
      const incoming = JSON.parse(options.body);
      requests.push(incoming);
      server = resolveSave(server, incoming);
    }
    return Response.json(server);
  });
  localStorage.setItem('fitfrog.id', 'abcdefghijkl');
  localStorage.setItem('fitfrog.log', JSON.stringify(server.log));
  localStorage.setItem('fitfrog.savedAt', '100');
  pendingPush = null;
});

test('stale focused PC receives and displays the union after its save', async () => {
  server = {savedAt: 200, log: log(['walk'])};
  saveLog(log(['squats']));
  await pendingPush();
  assert.equal(requests[0].baseSavedAt, 100);
  assert.equal(requests[0].today, today);
  assert.deepEqual(loadLog().days[today].done, ['squats', 'walk']);
  assert.equal(updates, 1);
  const next = loadLog();
  next.days[today].done = ['squats'];
  saveLog(next);
  await pendingPush();
  assert.deepEqual(server.log.days[today].done, ['squats']);
  assert.equal(requests[1].baseSavedAt, 101);
  assert.equal(requests[0].savedAt, undefined);
});

test('focus refresh retains pending edits even when the remote timestamp is newer', async () => {
  saveLog(log(['squats']));
  server = {savedAt: 200, log: log(['walk'])};
  assert.equal(await sync(), false);
  assert.deepEqual(loadLog().days[today].done, ['squats']);
  await pendingPush();
  assert.deepEqual(server.log.days[today].done, ['squats', 'walk']);
});

test('additional clicks during a save survive its response and the next save', async t => {
  server = {savedAt: 200, log: log(['walk'])};
  let release;
  const responseReady = new Promise(resolve => {release = resolve;});
  const handleFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async (...args) => {
    const response = await handleFetch(...args);
    await responseReady;
    return response;
  });
  saveLog(log(['squats']));
  const saving = pendingPush();
  // Untick the PC box and edit a note while the phone tick is being returned.
  const next = log();
  next.days[today].notes = 'Typed while saving';
  saveLog(next);
  release();
  await saving;
  assert.deepEqual(loadLog().days[today], {done: ['walk'], notes: 'Typed while saving'});
  await pendingPush();
  assert.deepEqual(server.log.days[today], {done: ['walk'], notes: 'Typed while saving'});
});

test('completion times returned during more local edits survive the following save', async t => {
  const completedAt = new Date().toISOString();
  server = {savedAt: 200, log: log(['walk'])};
  server.log.days[today].completedAt = {walk: completedAt};
  let release;
  const responseReady = new Promise(resolve => {release = resolve;});
  const handleFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async (...args) => {
    const response = await handleFetch(...args);
    await responseReady;
    return response;
  });
  saveLog(log(['squats']));
  const saving = pendingPush();
  const next = log(['squats']);
  next.days[today].notes = 'Edited during save';
  saveLog(next);
  release();
  await saving;
  assert.deepEqual(loadLog().days[today].completedAt, {walk: completedAt});
  await pendingPush();
  assert.deepEqual(server.log.days[today].completedAt, {walk: completedAt});
});

test('failed saves retain unsent local data and retry on sync', async t => {
  const handleFetch = globalThis.fetch;
  t.mock.method(console, 'warn', () => {});
  t.mock.method(globalThis, 'fetch', async () => new Response('Unavailable', {status: 503}));
  saveLog(log(['walk']));
  await pendingPush();
  assert.deepEqual(loadLog().days[today].done, ['walk']);
  assert.equal(localStorage.getItem('fitfrog.savedAt'), '100');
  assert.equal(localStorage.getItem('fitfrog.needsSave'), 'true');
  t.mock.method(globalThis, 'fetch', handleFetch);
  await sync();
  await pendingPush();
  assert.deepEqual(server.log.days[today].done, ['walk']);
});

test('pending edits stay marked unsent after a save reply and a subsequent refresh', async t => {
  clock = 102;
  server = {savedAt: 102, log: log()};
  let release;
  const responseReady = new Promise(resolve => {release = resolve;});
  const handleFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const response = await handleFetch(url, options);
    if (options?.method === 'PUT') await responseReady;
    return response;
  });
  saveLog(log(['walk']));
  const saving = pendingPush();
  const next = log(['walk', 'squats']);
  next.days[today].notes = 'Not sent yet';
  saveLog(next);
  release();
  await saving;
  assert.equal(localStorage.getItem('fitfrog.savedAt'), '103');
  assert.equal(localStorage.getItem('fitfrog.needsSave'), 'true');
  server = {savedAt: 104, log: log(['walk'])};
  assert.equal(await sync(), false);
  assert.deepEqual(loadLog().days[today], {done: ['walk', 'squats'], notes: 'Not sent yet'});
  await pendingPush();
  assert.deepEqual(server.log.days[today], {done: ['walk', 'squats'], notes: 'Not sent yet'});
  assert.equal(localStorage.getItem('fitfrog.needsSave'), 'false');
});

test('adopting a newer remote copy or shared ID resets the baseline', async () => {
  server = {savedAt: 200, log: log(['walk'])};
  assert.equal(await sync(), true);
  assert.equal(localStorage.getItem('fitfrog.savedAt'), '200');
  server = {savedAt: 300, log: log(['squats'])};
  assert.equal(await adoptId('mnopqrstuvwx'), true);
  saveLog(log());
  await pendingPush();
  assert.equal(requests[0].baseSavedAt, 300);
  assert.deepEqual(server.log.days[today].done, []);
});

test('overnight PC edit retains phone ticks for today when its log only contained yesterday', async () => {
  const yesterday = shiftDate(today, -1);
  const pc = log();
  pc.startDate = yesterday;
  pc.days = {[yesterday]: {done: ['walk'], notes: 'Yesterday'}};
  localStorage.setItem('fitfrog.log', JSON.stringify(pc));
  server = {savedAt: 200, log: log(['walk'])};
  const next = loadLog();
  next.days[today] = {done: ['squats'], notes: ''};
  saveLog(next);
  await pendingPush();
  assert.deepEqual(server.log.days[today].done, ['squats', 'walk']);
  assert.deepEqual(server.log.days[yesterday], {done: ['walk'], notes: 'Yesterday'});
  assert.deepEqual(loadLog(), server.log);
});

test('a delayed refresh cannot overwrite the result of a completed save', async t => {
  let release;
  const responseReady = new Promise(resolve => {release = resolve;});
  const handleFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const response = await handleFetch(url, options);
    if (!options) await responseReady;
    return response;
  });
  const refreshing = sync();
  saveLog(log(['walk']));
  await pendingPush();
  release();
  assert.equal(await refreshing, false);
  assert.deepEqual(loadLog().days[today].done, ['walk']);
});
