/**
 * Canvas-based Realtime Audio & State Visualizer for Utkio Lab
 */

export class AudioVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.animationId = null;
    this.state = 'IDLE'; // 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING'
    this.phase = 0;

    if (this.canvas) {
      this.resize();
      this.startLoop();
    }
  }

  resize() {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = (rect.width || 220) * dpr;
    this.canvas.height = (rect.height || 40) * dpr;
    if (this.ctx) this.ctx.scale(dpr, dpr);
  }

  setState(newState) {
    this.state = newState;
  }

  startLoop() {
    const render = () => {
      this.draw();
      this.animationId = requestAnimationFrame(render);
    };
    render();
  }

  stopLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  draw() {
    if (!this.ctx || !this.canvas) return;
    const width = this.canvas.getBoundingClientRect().width || 220;
    const height = this.canvas.getBoundingClientRect().height || 40;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, width, height);

    this.phase += 0.08;

    const centerY = height / 2;
    const barCount = 24;
    const spacing = width / barCount;

    let barColor = 'rgba(148, 163, 184, 0.25)';
    let maxAmp = 3;

    if (this.state === 'LISTENING') {
      barColor = '#ff7849'; // Orange pulse
      maxAmp = 14;
    } else if (this.state === 'THINKING') {
      barColor = '#06b6d4'; // Cyan thinking flow
      maxAmp = 9;
    } else if (this.state === 'SPEAKING') {
      barColor = '#10b981'; // Green speaking rhythm
      maxAmp = 16;
    }

    for (let i = 0; i < barCount; i++) {
      const x = i * spacing + spacing / 2;
      let amp = 2;

      if (this.state === 'LISTENING') {
        const sinVal = Math.sin(this.phase + i * 0.4);
        amp = Math.max(3, Math.abs(sinVal) * maxAmp * (0.6 + Math.random() * 0.4));
      } else if (this.state === 'THINKING') {
        const wave = Math.sin(this.phase * 1.5 + i * 0.3);
        amp = 4 + (wave + 1) * (maxAmp / 2);
      } else if (this.state === 'SPEAKING') {
        const wave1 = Math.sin(this.phase * 1.2 + i * 0.5);
        const wave2 = Math.cos(this.phase * 0.8 + i * 0.2);
        amp = Math.max(4, Math.abs(wave1 * wave2) * maxAmp * 1.2);
      } else {
        amp = 2 + Math.sin(this.phase * 0.3 + i * 0.2) * 1.5;
      }

      ctx.fillStyle = barColor;
      ctx.beginPath();
      ctx.roundRect(x - 2, centerY - amp / 2, 4, amp, 2);
      ctx.fill();
    }
  }
}
