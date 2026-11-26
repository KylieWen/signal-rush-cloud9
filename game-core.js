'use strict';

/*
 * Signal Rush — dependency-free game rules.
 * This module has no DOM, storage, audio, clock, or rendering dependencies.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SignalRushCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const ROUND_DURATION_MS = 45000;
  const MAX_TARGETS = 5;
  const TARGET_TYPES = Object.freeze({
    signal: Object.freeze({ basePoints: 100, radius: 33, ttl: 2850 }),
    bonus: Object.freeze({ basePoints: 200, radius: 28, ttl: 2050 }),
    noise: Object.freeze({ basePoints: -75, radius: 29, ttl: 2900 }),
  });
  const MULTIPLIERS = Object.freeze([
    { streak: 0, value: 1 },
    { streak: 4, value: 1.5 },
    { streak: 9, value: 2 },
    { streak: 16, value: 3 },
    { streak: 25, value: 4 },
  ]);

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function getMultiplier(streak) {
    let value = 1;
    for (const step of MULTIPLIERS) if (streak >= step.streak) value = step.value;
    return value;
  }

  function calculateAccuracy(hits, attempts) {
    return attempts > 0 ? clamp(hits / attempts, 0, 1) : 0;
  }

  function calculateGrade(score, accuracy, hits) {
    if (hits >= 30 && score >= 14000 && accuracy >= 0.85) return 'S';
    if (hits >= 20 && score >= 9000 && accuracy >= 0.7) return 'A';
    if (score >= 5500 && accuracy >= 0.55) return 'B';
    if (score >= 2500) return 'C';
    return 'D';
  }

  function formatClock(milliseconds) {
    const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function makeTarget({ id, width, height, elapsedMs, random }) {
    const roll = random();
    const type = roll < 0.17 ? 'noise' : roll < 0.36 ? 'bonus' : 'signal';
    const spec = TARGET_TYPES[type];
    const progress = clamp(elapsedMs / ROUND_DURATION_MS, 0, 1);
    const margin = spec.radius + 20;
    const angle = random() * Math.PI * 2;
    const speed = (type === 'bonus' ? 54 : 38) + progress * 42 + random() * 20;
    return {
      id,
      type,
      x: margin + random() * Math.max(1, width - margin * 2),
      y: margin + random() * Math.max(1, height - margin * 2),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: spec.radius,
      ageMs: 0,
      ttl: spec.ttl - progress * 450 + random() * 250,
      rotation: random() * Math.PI * 2,
      spin: (random() - 0.5) * 1.8,
      pulse: random() * Math.PI * 2,
    };
  }

  class SignalRushGame {
    constructor(options = {}) {
      this.random = options.random || Math.random;
      this.width = options.width || 960;
      this.height = options.height || 540;
      this.motionScale = options.motionScale ?? 1;
      this.reset();
    }

    reset() {
      this.status = 'ready';
      this.elapsedMs = 0;
      this.score = 0;
      this.streak = 0;
      this.bestStreak = 0;
      this.hits = 0;
      this.bonusHits = 0;
      this.misses = 0;
      this.noiseHits = 0;
      this.attempts = 0;
      this.expired = 0;
      this.targets = [];
      this.particles = [];
      this.nextId = 1;
      this.nextSpawnMs = 500;
      this.selectedId = null;
      this.lastEvent = null;
    }

    start() {
      this.reset();
      this.status = 'running';
      this.spawnTarget();
      this.spawnTarget();
      return this;
    }

    setBounds(width, height) {
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
      const scaleX = width / this.width;
      const scaleY = height / this.height;
      this.width = width;
      this.height = height;
      for (const target of this.targets) {
        target.x = clamp(target.x * scaleX, target.radius + 8, width - target.radius - 8);
        target.y = clamp(target.y * scaleY, target.radius + 8, height - target.radius - 8);
      }
    }

    spawnTarget() {
      if (this.targets.length >= MAX_TARGETS) return null;
      const target = makeTarget({
        id: this.nextId++,
        width: this.width,
        height: this.height,
        elapsedMs: this.elapsedMs,
        random: this.random,
      });
      this.targets.push(target);
      return target;
    }

    pause() {
      if (this.status === 'running') this.status = 'paused';
      return this.status;
    }

    resume() {
      if (this.status === 'paused') this.status = 'running';
      return this.status;
    }

    finish() {
      if (this.status === 'running' || this.status === 'paused') {
        this.status = 'finished';
        this.targets = [];
        this.selectedId = null;
      }
      return this.status;
    }

    update(deltaMs) {
      if (this.status !== 'running' || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
      // A background tab must never advance a round by a large hidden interval.
      const dt = Math.min(deltaMs, 100);
      this.elapsedMs = Math.min(ROUND_DURATION_MS, this.elapsedMs + dt);
      const motionDt = (dt / 1000) * this.motionScale;

      for (const target of this.targets) {
        target.ageMs += dt;
        target.x += target.vx * motionDt;
        target.y += target.vy * motionDt;
        target.rotation += target.spin * motionDt;
        target.pulse += dt / 350;
        if (target.x < target.radius + 8 || target.x > this.width - target.radius - 8) {
          target.vx *= -1;
          target.x = clamp(target.x, target.radius + 8, this.width - target.radius - 8);
        }
        if (target.y < target.radius + 8 || target.y > this.height - target.radius - 8) {
          target.vy *= -1;
          target.y = clamp(target.y, target.radius + 8, this.height - target.radius - 8);
        }
      }

      this.targets = this.targets.filter((target) => {
        if (target.ageMs < target.ttl) return true;
        this.expired += 1;
        if (target.type !== 'noise') {
          this.misses += 1;
          this.streak = 0;
        }
        if (this.selectedId === target.id) this.selectedId = null;
        return false;
      });

      if (this.elapsedMs >= this.nextSpawnMs && this.targets.length < MAX_TARGETS) {
        this.spawnTarget();
        const progress = this.elapsedMs / ROUND_DURATION_MS;
        this.nextSpawnMs = this.elapsedMs + 820 - progress * 330;
      }

      if (this.elapsedMs >= ROUND_DURATION_MS) this.finish();
    }

    findTargetAt(x, y) {
      let match = null;
      let nearest = Infinity;
      for (const target of this.targets) {
        const distance = Math.hypot(x - target.x, y - target.y);
        if (distance <= target.radius + 6 && distance < nearest) {
          match = target;
          nearest = distance;
        }
      }
      return match;
    }

    attemptHit(x, y) {
      if (this.status !== 'running') return { kind: 'blocked', points: 0 };
      this.attempts += 1;
      const target = this.findTargetAt(x, y);
      if (!target) {
        this.misses += 1;
        this.streak = 0;
        this.score = Math.max(0, this.score - 25);
        this.lastEvent = { kind: 'miss', points: -25 };
        return { ...this.lastEvent, x, y };
      }
      return this.hitTarget(target);
    }

    hitTarget(target) {
      if (this.status !== 'running' || !this.targets.includes(target)) {
        return { kind: 'blocked', points: 0 };
      }
      this.attempts += 1;
      const result = { kind: target.type, targetId: target.id, x: target.x, y: target.y };
      this.targets = this.targets.filter((item) => item.id !== target.id);
      if (this.selectedId === target.id) this.selectedId = null;

      if (target.type === 'noise') {
        this.noiseHits += 1;
        this.streak = 0;
        result.points = -75;
        this.score = Math.max(0, this.score + result.points);
      } else {
        const multiplier = getMultiplier(this.streak);
        const base = TARGET_TYPES[target.type].basePoints;
        result.multiplier = multiplier;
        result.points = Math.round(base * multiplier);
        this.hits += 1;
        if (target.type === 'bonus') this.bonusHits += 1;
        this.streak += 1;
        this.bestStreak = Math.max(this.bestStreak, this.streak);
        this.score += result.points;
      }
      this.lastEvent = result;
      return result;
    }

    cycleSelection(direction = 1) {
      if (this.status !== 'running') return null;
      const candidates = this.targets.filter((target) => target.type !== 'noise');
      if (!candidates.length) return null;
      const currentIndex = candidates.findIndex((target) => target.id === this.selectedId);
      const nextIndex = (currentIndex + (direction >= 0 ? 1 : -1) + candidates.length) % candidates.length;
      this.selectedId = candidates[currentIndex < 0 && direction < 0 ? candidates.length - 1 : nextIndex].id;
      return candidates.find((target) => target.id === this.selectedId);
    }

    selectNearest() {
      if (this.status !== 'running') return null;
      const candidates = this.targets.filter((target) => target.type !== 'noise');
      candidates.sort((a, b) => {
        const distanceA = Math.hypot(a.x - this.width / 2, a.y - this.height / 2);
        const distanceB = Math.hypot(b.x - this.width / 2, b.y - this.height / 2);
        return distanceA - distanceB;
      });
      this.selectedId = candidates.length ? candidates[0].id : null;
      return candidates[0] || null;
    }

    attemptSelected() {
      if (this.status !== 'running') return { kind: 'blocked', points: 0 };
      const target = this.targets.find((item) => item.id === this.selectedId);
      if (!target) return this.attemptHit(-1000, -1000);
      return this.hitTarget(target);
    }

    getAccuracy() {
      return calculateAccuracy(this.hits, this.attempts);
    }

    getRemainingMs() {
      return Math.max(0, ROUND_DURATION_MS - this.elapsedMs);
    }

    getSnapshot() {
      return {
        status: this.status,
        elapsedMs: this.elapsedMs,
        remainingMs: this.getRemainingMs(),
        score: this.score,
        streak: this.streak,
        bestStreak: this.bestStreak,
        multiplier: getMultiplier(this.streak),
        hits: this.hits,
        bonusHits: this.bonusHits,
        misses: this.misses,
        noiseHits: this.noiseHits,
        attempts: this.attempts,
        expired: this.expired,
        accuracy: this.getAccuracy(),
        grade: calculateGrade(this.score, this.getAccuracy(), this.hits),
      };
    }
  }

  return {
    SignalRushGame,
    ROUND_DURATION_MS,
    MAX_TARGETS,
    TARGET_TYPES,
    MULTIPLIERS,
    getMultiplier,
    calculateAccuracy,
    calculateGrade,
    formatClock,
    clamp,
  };
});
