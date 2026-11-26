'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Leaderboard, cleanName, cleanEntry, sortEntries } = require('../leaderboard.js');

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test('names are normalized and bounded', () => {
  assert.equal(cleanName('  neo<script>  '), 'NEOSCRIPT');
  assert.equal(cleanName(''), 'PLAYER');
  assert.equal(cleanName('ABCDEFGHIJKLMNOP'), 'ABCDEFGHIJKL');
});

test('entries clamp invalid numeric values', () => {
  const entry = cleanEntry({ score: -4, accuracy: 4, hits: 2.9, timestamp: 0, grade: 'SS' });
  assert.equal(entry.score, 0);
  assert.equal(entry.accuracy, 1);
  assert.equal(entry.hits, 2);
  assert.equal(entry.grade, 'S');
  assert.ok(entry.timestamp > 0);
});

test('leaderboard sorts by score, accuracy, then timestamp', () => {
  const entries = sortEntries([
    { score: 100, accuracy: 0.5, timestamp: 3 },
    { score: 200, accuracy: 0.5, timestamp: 4 },
    { score: 200, accuracy: 0.9, timestamp: 5 },
    { score: 200, accuracy: 0.9, timestamp: 2 },
  ]);
  assert.deepEqual(entries.map((item) => item.timestamp), [2, 5, 4, 3]);
});

test('record persists a top-ten board and returns rank', () => {
  const board = new Leaderboard({ storage: memoryStorage() });
  for (let index = 0; index < 12; index += 1) {
    board.record({ name: `P${index}`, score: index * 100, accuracy: 0.8, timestamp: index + 1 });
  }
  const entries = board.list();
  assert.equal(entries.length, 10);
  assert.equal(entries[0].score, 1100);
  assert.equal(entries[9].score, 200);
  const result = board.record({ name: 'ACE', score: 5000, accuracy: 1, timestamp: 20 });
  assert.equal(result.rank, 1);
  assert.equal(board.list()[0].name, 'ACE');
});

test('corrupt storage falls back safely', () => {
  const storage = memoryStorage();
  storage.setItem('signalRush.leaderboard.v1', '{broken');
  const board = new Leaderboard({ storage });
  assert.deepEqual(board.list(), []);
  assert.equal(board.record({ score: 10 }).rank, 1);
});

test('board remains usable when storage is disabled', () => {
  const board = new Leaderboard();
  board.record({ name: 'LOCAL', score: 100 });
  assert.equal(board.list()[0].name, 'LOCAL');
  assert.deepEqual(board.clear(), []);
  assert.deepEqual(board.list(), []);
});
