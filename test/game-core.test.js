'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SignalRushGame,
  ROUND_DURATION_MS,
  MULTIPLIERS,
  getMultiplier,
  calculateAccuracy,
  calculateGrade,
  formatClock,
} = require('../game-core.js');

function fixedRandom(value = 0.5) {
  return () => value;
}

function newGame() {
  const game = new SignalRushGame({ random: fixedRandom(), width: 800, height: 450 });
  game.start();
  return game;
}

test('round constants and clock formatting are stable', () => {
  assert.equal(ROUND_DURATION_MS, 45000);
  assert.equal(formatClock(45000), '0:45');
  assert.equal(formatClock(1001), '0:02');
  assert.equal(formatClock(-1), '0:00');
});

test('multiplier tiers reward sustained streaks', () => {
  assert.equal(getMultiplier(0), 1);
  assert.equal(getMultiplier(3), 1);
  assert.equal(getMultiplier(4), 1.5);
  assert.equal(getMultiplier(9), 2);
  assert.equal(getMultiplier(16), 3);
  assert.equal(getMultiplier(25), 4);
  assert.equal(getMultiplier(999), 4);
  assert.equal(MULTIPLIERS.length, 5);
});

test('accuracy is bounded and empty attempts are zero', () => {
  assert.equal(calculateAccuracy(0, 0), 0);
  assert.equal(calculateAccuracy(3, 4), 0.75);
  assert.equal(calculateAccuracy(4, 4), 1);
  assert.equal(calculateAccuracy(5, 4), 1);
  assert.equal(calculateAccuracy(-1, 4), 0);
});

test('grades combine score, accuracy, and hit count', () => {
  assert.equal(calculateGrade(15000, 0.9, 35), 'S');
  assert.equal(calculateGrade(15000, 0.6, 35), 'B');
  assert.equal(calculateGrade(9500, 0.75, 22), 'A');
  assert.equal(calculateGrade(6000, 0.6, 10), 'B');
  assert.equal(calculateGrade(3000, 0.2, 4), 'C');
  assert.equal(calculateGrade(1000, 1, 10), 'D');
});

test('starting a round resets all results and creates playable targets', () => {
  const game = newGame();
  assert.equal(game.status, 'running');
  assert.equal(game.targets.length, 2);
  assert.equal(game.score, 0);
  game.attemptHit(-100, -100);
  game.score = 500;
  game.start();
  assert.equal(game.status, 'running');
  assert.equal(game.score, 0);
  assert.equal(game.attempts, 0);
  assert.equal(game.misses, 0);
  assert.equal(game.targets.length, 2);
});

test('signal hits award points and increase the streak', () => {
  const game = newGame();
  const target = game.targets[0];
  const result = game.hitTarget(target);
  assert.equal(result.kind, 'signal');
  assert.equal(result.points, 100);
  assert.equal(game.score, 100);
  assert.equal(game.hits, 1);
  assert.equal(game.streak, 1);
  assert.equal(game.bestStreak, 1);
  assert.equal(game.attempts, 1);
  assert.equal(game.getAccuracy(), 1);
  assert.equal(game.targets.some((item) => item.id === target.id), false);
});

test('a four-hit streak activates the 1.5x multiplier on the next hit', () => {
  const game = newGame();
  let result;
  for (let index = 0; index < 5; index += 1) {
    game.spawnTarget();
    result = game.hitTarget(game.targets.find((item) => item.type === 'signal'));
  }
  assert.equal(result.multiplier, 1.5);
  assert.equal(result.points, 150);
  assert.equal(game.score, 550);
  assert.equal(game.streak, 5);
});

test('misses subtract points, reset streak, and affect accuracy', () => {
  const game = newGame();
  game.hitTarget(game.targets[0]);
  const result = game.attemptHit(-50, -50);
  assert.equal(result.kind, 'miss');
  assert.equal(game.score, 75);
  assert.equal(game.streak, 0);
  assert.equal(game.bestStreak, 1);
  assert.equal(game.misses, 1);
  assert.equal(game.attempts, 2);
  assert.equal(game.getAccuracy(), 0.5);
});

test('bonus targets use their own base value', () => {
  const game = new SignalRushGame({ random: fixedRandom(0.25) });
  game.start();
  const bonus = game.targets.find((item) => item.type === 'bonus');
  assert.ok(bonus);
  const result = game.hitTarget(bonus);
  assert.equal(result.kind, 'bonus');
  assert.equal(result.points, 200);
  assert.equal(game.bonusHits, 1);
});

test('noise targets penalize score, reset streak, and cannot make it negative', () => {
  const game = new SignalRushGame({ random: fixedRandom(0.1) });
  game.start();
  const noise = game.targets.find((item) => item.type === 'noise');
  assert.ok(noise);
  assert.equal(game.hitTarget(noise).points, -75);
  assert.equal(game.score, 0);
  assert.equal(game.noiseHits, 1);
  assert.equal(game.hits, 0);
});

test('expired signals count as misses and reset the streak', () => {
  const game = newGame();
  game.hitTarget(game.targets[0]);
  game.targets[0].ageMs = game.targets[0].ttl + 1;
  game.update(16);
  assert.equal(game.expired, 1);
  assert.equal(game.misses, 1);
  assert.equal(game.streak, 0);
  assert.equal(game.attempts, 1);
});

test('pause freezes time and blocks hits; resume continues the same round', () => {
  const game = newGame();
  game.update(1000);
  const elapsed = game.elapsedMs;
  const score = game.score;
  assert.equal(game.pause(), 'paused');
  game.update(5000);
  assert.equal(game.elapsedMs, elapsed);
  assert.equal(game.attemptHit(game.targets[0].x, game.targets[0].y).kind, 'blocked');
  assert.equal(game.attempts, 0);
  assert.equal(game.resume(), 'running');
  game.update(100);
  assert.ok(game.elapsedMs > elapsed);
  assert.equal(game.score, score);
});

test('long frame gaps are capped and the round ends at exactly 45 seconds', () => {
  const game = newGame();
  game.update(600000);
  assert.equal(game.elapsedMs, 100);
  for (let index = 0; index < 451; index += 1) game.update(100);
  assert.equal(game.elapsedMs, ROUND_DURATION_MS);
  assert.equal(game.status, 'finished');
  assert.equal(game.getRemainingMs(), 0);
  assert.equal(game.targets.length, 0);
});

test('finished rounds ignore input and cannot be resumed', () => {
  const game = newGame();
  game.finish();
  assert.equal(game.status, 'finished');
  assert.equal(game.resume(), 'finished');
  assert.equal(game.attemptHit(400, 200).kind, 'blocked');
  assert.equal(game.attempts, 0);
});

test('keyboard selection skips noise and cycles valid targets', () => {
  const game = newGame();
  const template = game.targets[0];
  game.targets = [
    { ...template, id: 10, type: 'noise', x: 400, y: 225 },
    { ...template, id: 11, type: 'signal', x: 180, y: 120 },
    { ...template, id: 12, type: 'bonus', x: 620, y: 330 },
  ];
  const first = game.selectNearest();
  assert.equal(first.id, 11);
  assert.notEqual(first.type, 'noise');
  const second = game.cycleSelection(1);
  assert.equal(second.id, 12);
  assert.notEqual(second.type, 'noise');
  assert.equal(game.hitTarget(second).kind, 'bonus');
});

test('a keyboard lock with no available target records a normal miss', () => {
  const game = newGame();
  game.targets = [];
  const result = game.attemptSelected();
  assert.equal(result.kind, 'miss');
  assert.equal(game.attempts, 1);
  assert.equal(game.misses, 1);
  assert.equal(game.score, 0);
});

test('pointer hit testing respects target radius', () => {
  const game = newGame();
  const target = game.targets[0];
  assert.equal(game.findTargetAt(target.x + target.radius, target.y).id, target.id);
  assert.equal(game.findTargetAt(target.x + target.radius + 20, target.y), null);
});

test('resizing keeps targets inside the new bounds', () => {
  const game = newGame();
  game.setBounds(320, 240);
  assert.equal(game.width, 320);
  for (const target of game.targets) {
    assert.ok(target.x >= target.radius + 8);
    assert.ok(target.x <= 320 - target.radius - 8);
    assert.ok(target.y >= target.radius + 8);
    assert.ok(target.y <= 240 - target.radius - 8);
  }
});

test('one hundred booth rounds reset cleanly without target leaks', () => {
  const game = new SignalRushGame({ random: fixedRandom(), width: 800, height: 450 });
  for (let round = 0; round < 100; round += 1) {
    game.start();
    for (let frame = 0; frame < 451 && game.status === 'running'; frame += 1) {
      if (frame % 20 === 0 && game.targets.length) game.hitTarget(game.targets[0]);
      game.update(100);
    }
    assert.equal(game.status, 'finished');
    assert.equal(game.targets.length, 0);
    assert.ok(game.score >= 0);
    assert.equal(game.nextId > 1, true);
  }
  game.start();
  assert.equal(game.score, 0);
  assert.equal(game.attempts, 0);
  assert.equal(game.targets.length, 2);
});

test('target population is capped', () => {
  const game = newGame();
  for (let index = 0; index < 20; index += 1) game.spawnTarget();
  assert.equal(game.targets.length, 5);
});
