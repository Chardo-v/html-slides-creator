/**
 * utils/charts.js — 轻量 SVG 图表工具
 *
 * 用法一（数据属性，自动初始化）：
 *   <div data-chart="bar"
 *        data-values="40,65,80,55,90"
 *        data-labels="Q1,Q2,Q3,Q4,Q5"
 *        style="flex:1; min-height:0"></div>
 *
 * 用法二（JS 调用）：
 *   Charts.bar(el, [40,65,80], { labels:['A','B','C'] });
 *   Charts.line(el, [40,65,80], { labels:['A','B','C'] });
 */
const Charts = (() => {
  const NS = 'http://www.w3.org/2000/svg';

  function mkEl(tag, attrs = {}) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  function mkSvg(w, h) {
    return mkEl('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', height: '100%' });
  }

  function mkText(x, y, content, attrs = {}) {
    const el = document.createElementNS(NS, 'text');
    el.setAttribute('x', x); el.setAttribute('y', y);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.textContent = content;
    return el;
  }

  /* ─── Bar Chart ───────────────────────────────────── */
  function bar(container, values, opts = {}) {
    const W = 640, H = 300;
    const pad = { top: 36, right: 20, bottom: 52, left: 20 };
    const {
      labels = values.map((_, i) => i + 1),
      showValues = true,
      barRadius = 6,
    } = opts;

    const s   = mkSvg(W, H);
    const maxV = Math.max(...values) || 1;
    const cW   = W - pad.left - pad.right;
    const cH   = H - pad.top  - pad.bottom;
    const bW   = cW / values.length;
    const bPad = Math.max(bW * 0.18, 10);
    const maxIdx = values.indexOf(Math.max(...values));

    // baseline
    s.appendChild(mkEl('line', {
      x1: pad.left, y1: H - pad.bottom,
      x2: W - pad.right, y2: H - pad.bottom,
      stroke: 'var(--border)', 'stroke-width': 1.5,
    }));

    values.forEach((v, i) => {
      const bH  = (v / maxV) * cH;
      const x   = pad.left + i * bW + bPad;
      const bAW = bW - bPad * 2;
      const y   = pad.top + cH - bH;
      const isMax = i === maxIdx;

      s.appendChild(mkEl('rect', {
        x, y, width: bAW, height: bH,
        rx: barRadius,
        fill: 'var(--accent)',
        opacity: isMax ? '1' : '0.4',
      }));

      if (showValues) {
        s.appendChild(mkText(x + bAW / 2, y - 9, v, {
          'text-anchor': 'middle',
          fill: 'var(--text)',
          'font-size': 14, 'font-weight': 600,
        }));
      }

      s.appendChild(mkText(x + bAW / 2, H - pad.bottom + 20, labels[i] ?? '', {
        'text-anchor': 'middle',
        fill: 'var(--muted)',
        'font-size': 13,
      }));
    });

    container.innerHTML = '';
    container.appendChild(s);
  }

  /* ─── Line Chart ──────────────────────────────────── */
  function line(container, seriesData, opts = {}) {
    const isMulti = Array.isArray(seriesData[0]?.values);
    const series  = isMulti
      ? seriesData
      : [{ values: seriesData, color: 'var(--accent)' }];

    const W = 640, H = 300;
    const pad = { top: 36, right: 32, bottom: 52, left: 52 };
    const { labels = [], showGrid = true, showDots = true } = opts;

    const s      = mkSvg(W, H);
    const allV   = series.flatMap(s => s.values);
    const maxV   = Math.max(...allV) || 1;
    const cW     = W - pad.left - pad.right;
    const cH     = H - pad.top  - pad.bottom;
    const n      = Math.max(...series.map(s => s.values.length));

    const xPos = i => pad.left + (n > 1 ? (i / (n - 1)) * cW : cW / 2);
    const yPos = v => pad.top  + cH * (1 - v / maxV);

    // grid & y-axis labels
    if (showGrid) {
      [0.25, 0.5, 0.75, 1].forEach(t => {
        const y = pad.top + cH * (1 - t);
        s.appendChild(mkEl('line', {
          x1: pad.left, y1: y, x2: W - pad.right, y2: y,
          stroke: 'var(--border)', 'stroke-width': 1, 'stroke-dasharray': '4 4',
        }));
        s.appendChild(mkText(pad.left - 8, y + 5, Math.round(maxV * t), {
          'text-anchor': 'end', fill: 'var(--muted)', 'font-size': 13,
        }));
      });
    }

    // axes
    s.appendChild(mkEl('line', {
      x1: pad.left, y1: pad.top, x2: pad.left, y2: H - pad.bottom,
      stroke: 'var(--border)', 'stroke-width': 1.5,
    }));
    s.appendChild(mkEl('line', {
      x1: pad.left, y1: H - pad.bottom, x2: W - pad.right, y2: H - pad.bottom,
      stroke: 'var(--border)', 'stroke-width': 1.5,
    }));

    // x labels
    labels.forEach((lbl, i) => {
      s.appendChild(mkText(xPos(i), H - pad.bottom + 20, lbl, {
        'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 13,
      }));
    });

    const COLORS = ['var(--accent)', 'var(--muted)'];

    series.forEach((ser, si) => {
      const c   = ser.color || COLORS[si % COLORS.length];
      const pts = ser.values.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ');

      // area fill (single series only)
      if (!isMulti) {
        const d = `M ${xPos(0)},${H - pad.bottom} ` +
          ser.values.map((v, i) => `L ${xPos(i)},${yPos(v)}`).join(' ') +
          ` L ${xPos(n - 1)},${H - pad.bottom} Z`;
        s.appendChild(mkEl('path', { d, fill: 'var(--accent)', opacity: '0.08' }));
      }

      // line
      s.appendChild(mkEl('polyline', {
        points: pts, fill: 'none', stroke: c,
        'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
      }));

      // dots
      if (showDots) {
        ser.values.forEach((v, i) => {
          s.appendChild(mkEl('circle', {
            cx: xPos(i), cy: yPos(v), r: 5,
            fill: 'var(--bg-base)', stroke: c, 'stroke-width': 2.5,
          }));
        });
      }
    });

    container.innerHTML = '';
    container.appendChild(s);
  }

  /* ─── Auto-init from data attributes ─────────────── */
  function _init() {
    document.querySelectorAll('[data-chart]:not([data-chart-done])').forEach(el => {
      el.setAttribute('data-chart-done', '1');
      const type   = el.dataset.chart;
      const values = (el.dataset.values || '').split(',').map(Number).filter(n => !isNaN(n));
      const labels = el.dataset.labels ? el.dataset.labels.split(',') : undefined;
      if (!values.length) return;
      if (type === 'bar')  bar (el, values, { labels });
      if (type === 'line') line(el, values, { labels });
    });
  }

  window.addEventListener('pres-ready',    _init);
  window.addEventListener('slide-change',  _init);

  return { bar, line };
})();
