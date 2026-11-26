'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SignalRushLeaderboard = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const STORAGE_KEY = 'signalRush.leaderboard.v1';
  const MAX_ENTRIES = 10;

  function cleanName(value) {
    const name = String(value || 'PLAYER').toUpperCase().replace(/[^A-Z0-9 _-]/g, '').trim();
    return (name || 'PLAYER').slice(0, 12);
  }

  function cleanEntry(entry) {
    const score = Number(entry && entry.score);
    const accuracy = Number(entry && entry.accuracy);
    const hits = Number(entry && entry.hits);
    const timestamp = Number(entry && entry.timestamp);
    return {
      name: cleanName(entry && entry.name),
      score: Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0,
      accuracy: Number.isFinite(accuracy) ? Math.max(0, Math.min(1, accuracy)) : 0,
      hits: Number.isFinite(hits) ? Math.max(0, Math.floor(hits)) : 0,
      grade: String(entry && entry.grade || 'D').slice(0, 1),
      timestamp: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now(),
    };
  }

  function sortEntries(entries) {
    return entries.slice().sort((a, b) => b.score - a.score || b.accuracy - a.accuracy || a.timestamp - b.timestamp);
  }

  class Leaderboard {
    constructor(options = {}) {
      this.storage = options.storage || null;
      this.key = options.key || STORAGE_KEY;
      this.limit = Math.max(1, Math.min(MAX_ENTRIES, Number(options.limit) || MAX_ENTRIES));
      this.memory = [];
    }

    list() {
      if (!this.storage) return this.memory.slice();
      try {
        const raw = this.storage.getItem(this.key);
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) return this.memory.slice();
        return sortEntries(parsed.map(cleanEntry)).slice(0, this.limit);
      } catch (_) { return this.memory.slice(); }
    }

    record(entry) {
      const cleaned = cleanEntry(entry);
      const entries = sortEntries([...this.list(), cleaned]).slice(0, this.limit);
      this.memory = entries;
      if (this.storage) {
        try { this.storage.setItem(this.key, JSON.stringify(entries)); } catch (_) { /* Storage can be unavailable on locked-down kiosks. */ }
      }
      const rank = entries.findIndex((item) => item.timestamp === cleaned.timestamp && item.score === cleaned.score && item.name === cleaned.name);
      return { entries, rank: rank < 0 ? null : rank + 1, entry: cleaned };
    }

    clear() {
      if (this.storage) {
        try { this.storage.removeItem(this.key); } catch (_) { /* Keep the in-memory board usable. */ }
      }
      this.memory = [];
      return [];
    }
  }

  return { Leaderboard, STORAGE_KEY, MAX_ENTRIES, cleanName, cleanEntry, sortEntries };
});
