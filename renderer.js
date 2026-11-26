'use strict';

/* Original Canvas geometry for Signal Rush. No image or font assets. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SignalRushRenderer = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const TAU = Math.PI * 2;
  const COLORS = { cyan: '#62f3ff', blue: '#5791ff', red: '#ff668c', white: '#dffbff' };

  class Renderer {
    constructor(canvas, getGame) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.getGame = getGame;
      this.width = 0;
      this.height = 0;
      this.dpr = 1;
      this.particles = [];
      this.stars = Array.from({ length: 55 }, (_, index) => ({
        x: ((index * 73.37) % 100) / 100,
        y: ((index * 41.73 + 13) % 100) / 100,
        size: index % 7 === 0 ? 1.5 : 0.8,
        phase: index * 0.73,
      }));
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (width === this.width && height === this.height && dpr === this.dpr) return;
      this.width = width;
      this.height = height;
      this.dpr = dpr;
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.getGame().setBounds(width, height);
    }

    burst(x, y, kind) {
      const color = kind === 'noise' ? COLORS.red : kind === 'bonus' ? COLORS.blue : COLORS.cyan;
      const count = kind === 'miss' ? 5 : 15;
      for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * TAU + Math.random() * 0.3;
        const speed = 45 + Math.random() * 115;
        this.particles.push({
          x, y, color,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          decay: 1.6 + Math.random(),
          size: 1.5 + Math.random() * 2,
        });
      }
    }

    update(deltaMs, reducedMotion) {
      if (reducedMotion) return;
      const dt = deltaMs / 1000;
      for (const particle of this.particles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= 0.97;
        particle.vy *= 0.97;
        particle.life -= particle.decay * dt;
      }
      this.particles = this.particles.filter((particle) => particle.life > 0);
    }

    render(time, reducedMotion) {
      const ctx = this.ctx;
      const w = this.width;
      const h = this.height;
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);
      this.drawBackground(time, reducedMotion);
      const game = this.getGame();
      if (game.status === 'ready') this.drawIdle(time, reducedMotion);
      if (game.status === 'running' || game.status === 'paused') {
        for (const target of game.targets) this.drawTarget(target, time, reducedMotion);
        this.drawSelection(game);
      }
      this.drawParticles();
      if (game.status === 'paused') {
        ctx.fillStyle = 'rgba(3, 12, 21, 0.2)';
        ctx.fillRect(0, 0, w, h);
      }
    }

    drawBackground(time, reducedMotion) {
      const ctx = this.ctx;
      const w = this.width;
      const h = this.height;
      const drift = reducedMotion ? 0 : (time / 1000) * 4;
      const spacing = w < 500 ? 40 : 54;

      const glow = ctx.createRadialGradient(w * 0.5, h * 0.48, 0, w * 0.5, h * 0.48, Math.max(w, h) * 0.55);
      glow.addColorStop(0, 'rgba(22, 94, 124, 0.2)');
      glow.addColorStop(0.55, 'rgba(7, 35, 53, 0.08)');
      glow.addColorStop(1, 'rgba(2, 9, 16, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(82, 171, 207, 0.07)';
      ctx.beginPath();
      for (let x = -spacing + (drift % spacing); x < w + spacing; x += spacing) {
        ctx.moveTo(x, 0); ctx.lineTo(x, h);
      }
      for (let y = -spacing + (drift % spacing); y < h + spacing; y += spacing) {
        ctx.moveTo(0, y); ctx.lineTo(w, y);
      }
      ctx.stroke();

      ctx.strokeStyle = 'rgba(82, 171, 207, 0.045)';
      ctx.beginPath();
      ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
      ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
      ctx.stroke();

      for (const star of this.stars) {
        const alpha = 0.12 + (Math.sin(time / 1100 + star.phase) + 1) * 0.08;
        ctx.fillStyle = `rgba(153, 228, 246, ${reducedMotion ? 0.15 : alpha})`;
        ctx.fillRect(star.x * w, star.y * h, star.size, star.size);
      }

      const radius = Math.min(w, h) * 0.31;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.strokeStyle = 'rgba(92, 210, 237, 0.065)';
      ctx.setLineDash([4, 12]);
      ctx.lineDashOffset = reducedMotion ? 0 : -time / 70;
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(92, 210, 237, 0.04)';
      ctx.beginPath(); ctx.arc(0, 0, radius * 0.66, 0, TAU); ctx.stroke();
      ctx.restore();

      if (!reducedMotion) {
        const scanY = ((time / 18) % (h + 100)) - 50;
        const scan = ctx.createLinearGradient(0, scanY - 25, 0, scanY + 25);
        scan.addColorStop(0, 'rgba(98, 243, 255, 0)');
        scan.addColorStop(0.5, 'rgba(98, 243, 255, 0.026)');
        scan.addColorStop(1, 'rgba(98, 243, 255, 0)');
        ctx.fillStyle = scan;
        ctx.fillRect(0, scanY - 25, w, 50);
      }
    }

    drawIdle(time, reducedMotion) {
      const ctx = this.ctx;
      const w = this.width;
      const h = this.height;
      ctx.save();
      ctx.globalAlpha = 0.12;
      const drift = reducedMotion ? 0 : Math.sin(time / 2200) * 8;
      this.geometry(w * 0.16, h * 0.28 + drift, 22, 'signal', time, reducedMotion);
      this.geometry(w * 0.84, h * 0.65 - drift, 19, 'bonus', time, reducedMotion);
      this.geometry(w * 0.21, h * 0.79 - drift, 15, 'noise', time, reducedMotion);
      this.geometry(w * 0.78, h * 0.24 + drift, 13, 'signal', time, reducedMotion);
      ctx.restore();
    }

    geometry(x, y, radius, type, time, reducedMotion) {
      const ctx = this.ctx;
      const rotation = reducedMotion ? Math.PI / 4 : time / 2600 + Math.PI / 4;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.strokeStyle = type === 'noise' ? COLORS.red : type === 'bonus' ? COLORS.blue : COLORS.cyan;
      ctx.fillStyle = type === 'noise' ? COLORS.red : type === 'bonus' ? COLORS.blue : COLORS.cyan;
      ctx.lineWidth = 1.3;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 15;
      if (type === 'noise') {
        ctx.beginPath();
        for (let point = 0; point < 16; point += 1) {
          const angle = point / 16 * TAU;
          const length = point % 2 === 0 ? radius : radius * 0.42;
          const px = Math.cos(angle) * length;
          const py = Math.sin(angle) * length;
          if (point === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.stroke();
      } else if (type === 'bonus') {
        ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, radius * 0.62, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.stroke();
      } else {
        ctx.strokeRect(-radius / 1.4, -radius / 1.4, radius * 1.42, radius * 1.42);
        ctx.fillRect(-3, -3, 6, 6);
      }
      ctx.restore();
    }

    drawTarget(target, time, reducedMotion) {
      const ctx = this.ctx;
      const life = Math.max(0, 1 - target.ageMs / target.ttl);
      const pulse = reducedMotion ? 0.75 : 0.82 + Math.sin(target.pulse) * 0.18;
      const color = target.type === 'noise' ? COLORS.red : target.type === 'bonus' ? COLORS.blue : COLORS.cyan;
      ctx.save();
      ctx.globalAlpha = life < 0.22 ? 0.5 + Math.sin(time / 55) * 0.35 : 1;
      ctx.translate(target.x, target.y);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1.6;
      ctx.shadowColor = color;
      ctx.shadowBlur = 18 * pulse;

      // Lifetime arc is a readable countdown around every target.
      ctx.save();
      ctx.globalAlpha *= 0.42;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, target.radius + 8, -Math.PI / 2, -Math.PI / 2 + TAU * life);
      ctx.stroke();
      ctx.restore();

      ctx.rotate(target.rotation);
      if (target.type === 'signal') {
        const size = target.radius * 0.72;
        ctx.strokeRect(-size, -size, size * 2, size * 2);
        ctx.globalAlpha *= 0.16;
        ctx.fillRect(-size, -size, size * 2, size * 2);
        ctx.globalAlpha = life < 0.22 ? 0.6 + Math.sin(time / 55) * 0.3 : 1;
        ctx.fillRect(-4, -4, 8, 8);
        ctx.globalAlpha *= 0.65;
        ctx.beginPath();
        ctx.moveTo(-size - 5, 0); ctx.lineTo(-size + 2, 0);
        ctx.moveTo(size - 2, 0); ctx.lineTo(size + 5, 0);
        ctx.moveTo(0, -size - 5); ctx.lineTo(0, -size + 2);
        ctx.moveTo(0, size - 2); ctx.lineTo(0, size + 5);
        ctx.stroke();
      } else if (target.type === 'bonus') {
        ctx.beginPath(); ctx.arc(0, 0, target.radius * 0.75, 0, TAU); ctx.stroke();
        ctx.globalAlpha *= 0.28;
        ctx.beginPath(); ctx.arc(0, 0, target.radius * 0.48, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.rotate(-target.rotation);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.moveTo(0, -7); ctx.lineTo(0, 7);
        ctx.stroke();
      } else {
        ctx.beginPath();
        for (let point = 0; point < 16; point += 1) {
          const angle = point / 16 * TAU;
          const length = point % 2 === 0 ? target.radius * 0.85 : target.radius * 0.4;
          const px = Math.cos(angle) * length;
          const py = Math.sin(angle) * length;
          if (point === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.stroke();
        ctx.globalAlpha *= 0.2;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.rotate(-target.rotation);
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }

    drawSelection(game) {
      const target = game.targets.find((item) => item.id === game.selectedId);
      if (!target) return;
      const ctx = this.ctx;
      const size = target.radius + 16;
      const corner = 10;
      ctx.save();
      ctx.translate(target.x, target.y);
      ctx.strokeStyle = COLORS.white;
      ctx.lineWidth = 1.3;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(-size, -size + corner); ctx.lineTo(-size, -size); ctx.lineTo(-size + corner, -size);
      ctx.moveTo(size - corner, -size); ctx.lineTo(size, -size); ctx.lineTo(size, -size + corner);
      ctx.moveTo(size, size - corner); ctx.lineTo(size, size); ctx.lineTo(size - corner, size);
      ctx.moveTo(-size + corner, size); ctx.lineTo(-size, size); ctx.lineTo(-size, size - corner);
      ctx.stroke();
      ctx.fillStyle = COLORS.white;
      ctx.font = '8px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('LOCK', 0, -size - 7);
      ctx.restore();
    }

    drawParticles() {
      const ctx = this.ctx;
      ctx.save();
      for (const particle of this.particles) {
        ctx.globalAlpha = Math.max(0, particle.life);
        ctx.fillStyle = particle.color;
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 8;
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
      }
      ctx.restore();
    }
  }

  return { Renderer };
});
