'use strict';

(function () {
  const { SignalRushGame, MULTIPLIERS, ROUND_DURATION_MS } = window.SignalRushCore;
  const { Renderer } = window.SignalRushRenderer;
  const { SoundBank } = window.SignalRushAudio;
  const $ = (id) => document.getElementById(id);
  const STORAGE = { best: 'signalRush.best.v1', settings: 'signalRush.settings.v1' };

  const elements = {
    canvas: $('gameCanvas'), playfield: $('playfield'),
    startOverlay: $('startOverlay'), pauseOverlay: $('pauseOverlay'), resultsOverlay: $('resultsOverlay'),
    startButton: $('startButton'), resumeButton: $('resumeButton'), replayButton: $('replayButton'), quitButton: $('quitButton'),
    pauseButton: $('pauseButton'), soundButton: $('soundButton'),
    motionToggle: $('motionToggle'), soundToggle: $('soundToggle'),
    score: $('scoreValue'), time: $('timeValue'), streak: $('streakValue'), multiplier: $('multiplierValue'),
    accuracy: $('accuracyValue'), hits: $('hitValue'), timeProgress: $('timeProgress'), timeCard: $('timeCard'),
    pips: Array.from($('streakPips').children), systemStatus: $('systemStatus'), fieldMode: $('fieldMode'),
    comboFlare: $('comboFlare'), flareMultiplier: $('flareMultiplier'), feedback: $('hitFeedback'), callout: $('roundCallout'),
    menuBest: $('menuBest'), grade: $('gradeValue'), finalScore: $('finalScore'), finalHits: $('finalHits'),
    finalAccuracy: $('finalAccuracy'), finalStreak: $('finalStreak'), finalMisses: $('finalMisses'), finalBonus: $('finalBonus'),
    resultEyebrow: $('resultEyebrow'), resultMessage: $('resultMessage'), resultsTitle: $('resultsTitle'), newBest: $('newBest'),
    leaderboardOverlay: $('leaderboardOverlay'), leaderboardList: $('leaderboardList'), leaderboardButton: $('leaderboardButton'),
    resultsLeaderboardButton: $('resultsLeaderboardButton'), closeLeaderboardButton: $('closeLeaderboardButton'), clearLeaderboardButton: $('clearLeaderboardButton'),
    playerName: $('playerName'), rankLine: $('rankLine'), boothCountdown: $('boothCountdown'),
    announcer: $('announcer'),
  };

  function readJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (_) { return fallback; }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* Private mode can disable storage. */ }
  }

  const savedSettings = readJSON(STORAGE.settings, {});
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let hasMotionPreference = typeof savedSettings.reduced === 'boolean';
  const settings = {
    reduced: hasMotionPreference ? savedSettings.reduced : motionPreference.matches,
    sound: typeof savedSettings.sound === 'boolean' ? savedSettings.sound : true,
  };
  const storedBest = Number(readJSON(STORAGE.best, 0));
  let bestScore = Number.isFinite(storedBest) && storedBest > 0 ? Math.floor(storedBest) : 0;
  const game = new SignalRushGame({ motionScale: settings.reduced ? 0.35 : 1 });
  const sound = new SoundBank();
  const renderer = new Renderer(elements.canvas, () => game);
  let storage = null;
  try { storage = window.localStorage; } catch (_) { /* Kiosk policies can disable storage. */ }
  const leaderboard = new window.SignalRushLeaderboard.Leaderboard({ storage });
  const initialEntries = leaderboard.list();
  if (initialEntries.length) bestScore = Math.max(bestScore, initialEntries[0].score);
  const isBoothMode = new URLSearchParams(window.location.search).get('booth') === '1';
  let lastFrame = performance.now();
  let lastAnnouncement = '';
  let earlyFinish = false;
  let boothTimer = null;
  let boothDeadline = 0;
  let leaderboardReturn = 'start';

  function setText(element, value) {
    if (element.textContent !== String(value)) element.textContent = String(value);
  }

  function formatScore(score) { return String(Math.max(0, Math.floor(score))).padStart(6, '0'); }
  function announce(message) {
    if (message === lastAnnouncement) return;
    lastAnnouncement = message;
    elements.announcer.textContent = message;
  }

  function showOverlay(name) {
    elements.startOverlay.hidden = name !== 'start';
    elements.pauseOverlay.hidden = name !== 'pause';
    elements.resultsOverlay.hidden = name !== 'results';
    elements.leaderboardOverlay.hidden = name !== 'leaderboard';
  }

  function updateStatus(status) {
    const labels = { ready: 'SYSTEM READY', running: 'LIVE FEED', paused: 'FEED PAUSED', finished: 'RUN LOGGED' };
    const modes = { ready: 'AWAITING INPUT', running: 'TARGETS ACTIVE', paused: 'TIME FROZEN', finished: 'RUN COMPLETE' };
    elements.systemStatus.className = `system-status ${status}`;
    setText(elements.systemStatus.querySelector('span'), labels[status]);
    setText(elements.fieldMode, modes[status]);
    elements.pauseButton.disabled = status === 'ready' || status === 'finished';
    elements.pauseButton.classList.toggle('is-paused', status === 'paused');
    elements.pauseButton.setAttribute('aria-label', status === 'paused' ? 'Resume game' : 'Pause game');
  }

  function multiplierProgress() {
    let current = MULTIPLIERS[0];
    let next = null;
    for (const tier of MULTIPLIERS) {
      if (game.streak >= tier.streak) current = tier;
      else { next = tier; break; }
    }
    if (!next) return 1;
    return Math.max(0, Math.min(1, (game.streak - current.streak) / (next.streak - current.streak)));
  }

  function updateHUD() {
    const snapshot = game.getSnapshot();
    setText(elements.score, formatScore(snapshot.score));
    setText(elements.time, window.SignalRushCore.formatClock(snapshot.remainingMs));
    setText(elements.streak, snapshot.streak);
    setText(elements.multiplier, `×${snapshot.multiplier}`);
    setText(elements.accuracy, snapshot.attempts ? `${Math.round(snapshot.accuracy * 100)}%` : '—');
    setText(elements.hits, `${snapshot.hits} SIGNAL${snapshot.hits === 1 ? '' : 'S'}`);
    elements.timeProgress.style.transform = `scaleX(${snapshot.remainingMs / ROUND_DURATION_MS})`;
    elements.timeCard.classList.toggle('urgent', snapshot.status === 'running' && snapshot.remainingMs <= 10000);
    const progress = multiplierProgress();
    elements.pips.forEach((pip, index) => pip.classList.toggle('active', progress > index / elements.pips.length));
    elements.comboFlare.classList.toggle('visible', snapshot.status === 'running' && snapshot.multiplier >= 2);
    setText(elements.flareMultiplier, `×${snapshot.multiplier}`);
    if (snapshot.status === 'running' && snapshot.remainingMs <= 10000 && snapshot.remainingMs > 0) {
      const second = Math.ceil(snapshot.remainingMs / 1000);
      announce(`10 seconds remaining.${second === 10 ? '' : ` ${second}.`}`);
    }
  }

  function applySettings() {
    document.body.dataset.motion = settings.reduced ? 'reduced' : 'full';
    game.motionScale = settings.reduced ? 0.35 : 1;
    elements.motionToggle.checked = settings.reduced;
    elements.soundToggle.checked = settings.sound;
    sound.setEnabled(settings.sound);
    elements.soundButton.classList.toggle('muted', !settings.sound);
    elements.soundButton.setAttribute('aria-pressed', String(!settings.sound));
    elements.soundButton.setAttribute('aria-label', settings.sound ? 'Mute sound' : 'Enable sound');
    elements.soundButton.title = settings.sound ? 'Mute sound (M)' : 'Enable sound (M)';
    if (settings.reduced) renderer.particles = [];
    writeJSON(STORAGE.settings, {
      sound: settings.sound,
      ...(hasMotionPreference ? { reduced: settings.reduced } : {}),
    });
  }

  function toggleSound() {
    settings.sound = !settings.sound;
    applySettings();
    if (settings.sound) sound.play('signal');
    announce(settings.sound ? 'Sound on.' : 'Sound off.');
  }

  function toggleMotion() {
    hasMotionPreference = true;
    settings.reduced = !settings.reduced;
    applySettings();
    announce(settings.reduced ? 'Reduced motion on.' : 'Full motion on.');
  }

  motionPreference.addEventListener('change', (event) => {
    if (hasMotionPreference) return;
    settings.reduced = event.matches;
    applySettings();
  });

  function showCallout(text) {
    elements.callout.classList.remove('show');
    void elements.callout.offsetWidth;
    setText(elements.callout, text);
    elements.callout.classList.add('show');
  }

  function renderLeaderboard() {
    const entries = leaderboard.list();
    elements.leaderboardList.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement('li');
      empty.className = 'leaderboard-empty';
      empty.colSpan = 3;
      empty.textContent = 'No runs logged yet. The first signal is yours.';
      elements.leaderboardList.append(empty);
      return;
    }
    entries.forEach((entry, index) => {
      const row = document.createElement('li');
      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = String(index + 1).padStart(2, '0');
      const player = document.createElement('span');
      player.className = 'player';
      player.textContent = entry.name;
      const detail = document.createElement('small');
      detail.textContent = `GRADE ${entry.grade} · ${Math.round(entry.accuracy * 100)}% ACC · ${entry.hits} HITS`;
      player.append(detail);
      const points = document.createElement('span');
      points.className = 'points';
      points.textContent = formatScore(entry.score);
      row.append(rank, player, points);
      elements.leaderboardList.append(row);
    });
  }

  function stopBoothCountdown() {
    if (boothTimer) window.clearInterval(boothTimer);
    boothTimer = null;
    elements.boothCountdown.hidden = true;
  }

  function startBoothCountdown() {
    stopBoothCountdown();
    if (!isBoothMode || game.status !== 'finished') return;
    boothDeadline = performance.now() + 15000;
    elements.boothCountdown.hidden = false;
    boothTimer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((boothDeadline - performance.now()) / 1000));
      setText(elements.boothCountdown, `NEXT RUN IN ${remaining}`);
      if (remaining <= 0) startRound();
    }, 250);
  }

  function showLeaderboard(returnTo) {
    leaderboardReturn = returnTo;
    stopBoothCountdown();
    renderLeaderboard();
    showOverlay('leaderboard');
    elements.closeLeaderboardButton.focus({ preventScroll: true });
  }

  function closeLeaderboard() {
    showOverlay(leaderboardReturn);
    if (leaderboardReturn === 'results') startBoothCountdown();
  }

  function startRound() {
    stopBoothCountdown();
    sound.unlock();
    earlyFinish = false;
    renderer.particles = [];
    game.start();
    showOverlay(null);
    updateStatus('running');
    updateHUD();
    showCallout('GO');
    sound.play('start');
    announce('Run started. 45 seconds. Catch signals and avoid noise.');
    elements.canvas.focus({ preventScroll: true });
  }

  function pauseRound() {
    if (game.status !== 'running') return;
    game.pause();
    showOverlay('pause');
    updateStatus('paused');
    updateHUD();
    sound.play('pause');
    announce('Game paused. Press P or Escape to resume.');
    elements.resumeButton.focus({ preventScroll: true });
  }

  function resumeRound() {
    if (game.status !== 'paused') return;
    sound.unlock();
    game.resume();
    lastFrame = performance.now();
    showOverlay(null);
    updateStatus('running');
    sound.play('resume');
    announce('Game resumed.');
    elements.canvas.focus({ preventScroll: true });
  }

  function finishRound(options = {}) {
    // The core marks itself finished before the UI receives the timer event.
    if (game.status === 'ready') return;
    earlyFinish = Boolean(options.early);
    game.finish();
    const snapshot = game.getSnapshot();
    const isNewBest = !earlyFinish && snapshot.score > bestScore;
    if (isNewBest) {
      bestScore = snapshot.score;
      writeJSON(STORAGE.best, bestScore);
    }
    let localRank = null;
    if (!earlyFinish) {
      const saved = leaderboard.record({
        name: elements.playerName.value,
        score: snapshot.score,
        accuracy: snapshot.accuracy,
        hits: snapshot.hits,
        grade: snapshot.grade,
        timestamp: Date.now(),
      });
      localRank = saved.rank;
      bestScore = Math.max(bestScore, saved.entries.length ? saved.entries[0].score : 0);
      writeJSON(STORAGE.best, bestScore);
    }
    setText(elements.menuBest, formatScore(bestScore));
    setText(elements.rankLine, earlyFinish ? 'LOCAL RANK · NOT SAVED' : localRank ? `LOCAL RANK #${localRank}` : 'LOCAL RANK —');
    setText(elements.grade, snapshot.grade);
    setText(elements.finalScore, formatScore(snapshot.score));
    setText(elements.finalHits, snapshot.hits);
    setText(elements.finalAccuracy, `${Math.round(snapshot.accuracy * 100)}%`);
    setText(elements.finalStreak, snapshot.bestStreak);
    setText(elements.finalMisses, `${snapshot.misses} missed`);
    setText(elements.finalBonus, `${snapshot.bonusHits} bonuses`);
    elements.newBest.hidden = !isNewBest;

    const copy = {
      S: ['Signal elite.', 'Elite reflexes. The network is yours.'],
      A: ['Signal strong.', 'Sharp locks. You owned the frequency.'],
      B: ['Signal stable.', 'Solid run. Push for a cleaner streak.'],
      C: ['Signal acquired.', 'Good start. Chase a longer combo.'],
      D: ['Signal warm-up.', 'The next run is yours. Lock on faster.'],
    };
    setText(elements.resultsTitle, earlyFinish ? 'Signal logged.' : copy[snapshot.grade][0]);
    setText(elements.resultMessage, earlyFinish ? 'Run ended early. Jump back in when ready.' : copy[snapshot.grade][1]);
    setText(elements.resultEyebrow, isNewBest ? 'NEW PERSONAL BEST' : earlyFinish ? 'RUN ENDED EARLY' : 'RUN COMPLETE');
    showOverlay('results');
    updateStatus('finished');
    updateHUD();
    sound.play('finish');
    announce(`Run complete. Score ${snapshot.score}. Grade ${snapshot.grade}. ${snapshot.hits} signals, ${Math.round(snapshot.accuracy * 100)} percent accuracy.${isNewBest ? ' New local best.' : ''}${localRank ? ` Local rank ${localRank}.` : ''}`);
    elements.replayButton.focus({ preventScroll: true });
    startBoothCountdown();
  }

  function showFeedback(result) {
    const color = result.kind === 'noise' ? '#ff668c' : result.kind === 'bonus' ? '#78a7ff' : result.kind === 'miss' ? '#86a4b6' : '#62f3ff';
    const label = result.kind === 'bonus' ? `+${result.points} BONUS` : result.kind === 'noise' ? 'NOISE −75' : result.kind === 'miss' ? 'MISS −25' : `+${result.points}`;
    const x = Math.max(35, Math.min(renderer.width - 35, result.x || renderer.width / 2));
    const y = Math.max(45, Math.min(renderer.height - 15, (result.y || renderer.height / 2) - 28));
    elements.feedback.style.left = `${x}px`;
    elements.feedback.style.top = `${y}px`;
    elements.feedback.style.color = color;
    setText(elements.feedback, label);
    elements.feedback.classList.remove('show');
    void elements.feedback.offsetWidth;
    elements.feedback.classList.add('show');
    window.clearTimeout(showFeedback.timer);
    showFeedback.timer = window.setTimeout(() => elements.feedback.classList.remove('show'), 650);
  }

  function handleAttempt(result) {
    if (result.kind === 'blocked') return;
    renderer.burst(result.x || renderer.width / 2, result.y || renderer.height / 2, result.kind);
    showFeedback(result);
    sound.play(result.kind);
    updateHUD();
  }

  function handlePointer(event) {
    if (game.status !== 'running' || event.button > 0) return;
    event.preventDefault();
    const rect = elements.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (renderer.width / rect.width);
    const y = (event.clientY - rect.top) * (renderer.height / rect.height);
    elements.canvas.focus({ preventScroll: true });
    handleAttempt(game.attemptHit(x, y));
  }

  elements.startButton.addEventListener('click', startRound);
  elements.replayButton.addEventListener('click', startRound);
  elements.resumeButton.addEventListener('click', resumeRound);
  elements.quitButton.addEventListener('click', () => finishRound({ early: true }));
  elements.leaderboardButton.addEventListener('click', () => showLeaderboard('start'));
  elements.resultsLeaderboardButton.addEventListener('click', () => showLeaderboard('results'));
  elements.closeLeaderboardButton.addEventListener('click', closeLeaderboard);
  elements.clearLeaderboardButton.addEventListener('click', () => {
    if (!window.confirm('Clear all local Signal Rush scores?')) return;
    leaderboard.clear();
    bestScore = 0;
    writeJSON(STORAGE.best, 0);
    setText(elements.menuBest, formatScore(0));
    renderLeaderboard();
    announce('Local leaderboard cleared.');
  });
  elements.pauseButton.addEventListener('click', () => game.status === 'running' ? pauseRound() : resumeRound());
  elements.soundButton.addEventListener('click', toggleSound);
  elements.motionToggle.addEventListener('change', toggleMotion);
  elements.soundToggle.addEventListener('change', toggleSound);
  elements.canvas.addEventListener('pointerdown', handlePointer);
  elements.canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  document.addEventListener('keydown', (event) => {
    const tag = event.target.tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    const isButton = tag === 'BUTTON';
    if (isInput) return;
    const key = event.key.toLowerCase();
    if (key === 'escape' && !elements.leaderboardOverlay.hidden) {
      event.preventDefault(); closeLeaderboard(); return;
    }
    if (key === 'm' && !event.repeat) {
      event.preventDefault(); toggleSound(); return;
    }
    if (game.status === 'running') {
      if (key === 'p' || key === 'escape') {
        event.preventDefault(); if (!event.repeat) pauseRound(); return;
      }
      if (key === 'arrowleft' || key === 'arrowright') {
        event.preventDefault(); game.cycleSelection(key === 'arrowleft' ? -1 : 1); return;
      }
      if ((key === ' ' || key === 'enter') && !isButton) {
        event.preventDefault();
        if (event.repeat) return;
        if (!game.selectedId) game.selectNearest();
        handleAttempt(game.attemptSelected());
      }
    } else if (game.status === 'paused') {
      if (key === 'p' || key === 'escape') {
        event.preventDefault(); if (!event.repeat) resumeRound();
      }
    } else if (game.status === 'finished') {
      if ((key === 'r' || key === 'enter') && !isButton) {
        event.preventDefault(); if (!event.repeat) startRound();
      }
    } else if (game.status === 'ready' && (key === 'enter' || key === ' ') && !isButton) {
      event.preventDefault(); if (!event.repeat) startRound();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.status === 'running') pauseRound();
  });
  window.addEventListener('blur', () => {
    if (game.status === 'running') pauseRound();
  });
  window.addEventListener('resize', () => renderer.resize());
  if ('ResizeObserver' in window) new ResizeObserver(() => renderer.resize()).observe(elements.playfield);

  function frame(now) {
    const delta = Math.max(0, now - lastFrame);
    lastFrame = now;
    const wasRunning = game.status === 'running';
    game.update(delta);
    renderer.update(delta, settings.reduced);
    if (wasRunning && game.status === 'finished') finishRound();
    renderer.render(now, settings.reduced);
    updateHUD();
    requestAnimationFrame(frame);
  }

  window.addEventListener('storage', (event) => {
    if (event.key === window.SignalRushLeaderboard.STORAGE_KEY) renderLeaderboard();
  });
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));

  setText(elements.menuBest, formatScore(bestScore));
  applySettings();
  updateStatus('ready');
  renderer.resize();
  updateHUD();
  requestAnimationFrame(frame);
})();
