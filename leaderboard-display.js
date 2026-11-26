'use strict';

(function () {
  const { Leaderboard, STORAGE_KEY } = window.SignalRushLeaderboard;
  let storage = null;
  try { storage = window.localStorage; } catch (_) { /* Display remains usable without persistence. */ }
  const board = new Leaderboard({ storage });
  const list = document.getElementById('boardList');
  const status = document.getElementById('boardStatus');
  const topScore = document.getElementById('topScore');
  const announcer = document.getElementById('announcer');
  const clearButton = document.getElementById('clearBoard');
  const manage = new URLSearchParams(window.location.search).get('manage') === '1';
  clearButton.hidden = !manage;

  function formatScore(score) { return String(Math.max(0, Math.floor(score))).padStart(6, '0'); }

  function render() {
    const entries = board.list();
    list.replaceChildren();
    topScore.textContent = formatScore(entries.length ? entries[0].score : 0);
    status.textContent = entries.length ? `${entries.length} RUN${entries.length === 1 ? '' : 'S'} LOGGED` : 'WAITING FOR RUNS';
    if (!entries.length) {
      const empty = document.createElement('li');
      empty.className = 'board-empty';
      empty.textContent = 'NO RUNS YET · START SIGNAL RUSH ON THIS DEVICE';
      list.append(empty);
      return;
    }
    entries.forEach((entry, index) => {
      const row = document.createElement('li');
      const rank = document.createElement('span');
      rank.className = 'board-rank';
      rank.textContent = String(index + 1).padStart(2, '0');
      const name = document.createElement('span');
      name.className = 'board-name';
      name.textContent = entry.name;
      const detail = document.createElement('small');
      detail.textContent = `GRADE ${entry.grade} · ${Math.round(entry.accuracy * 100)}% ACC · ${entry.hits} HITS`;
      name.append(detail);
      const points = document.createElement('span');
      points.className = 'board-points';
      points.textContent = formatScore(entry.score);
      row.append(rank, name, points);
      list.append(row);
    });
  }

  function tickClock() {
    document.getElementById('clock').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  clearButton.addEventListener('click', () => {
    if (!window.confirm('Clear all local Signal Rush scores?')) return;
    board.clear();
    render();
    announcer.textContent = 'Local leaderboard cleared.';
  });
  window.addEventListener('storage', (event) => { if (event.key === STORAGE_KEY) render(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  render();
  tickClock();
  window.setInterval(tickClock, 1000);
})();
