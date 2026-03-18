/**
 * utils/plotly-charts.js — Plotly 图表自动初始化
 *
 * 用法一（数据属性，推荐）：
 *   <div data-plotly="bar"
 *        data-values="40,65,80,55,90"
 *        data-labels="Q1,Q2,Q3,Q4,Q5"
 *        style="flex:1; min-height:0"></div>
 *
 *   支持类型：bar / line / area / pie / scatter
 *
 *   可选属性：
 *     data-title="图表标题"
 *     data-y-title="Y轴标签"
 *     data-series='[{"name":"系列A","values":"1,2,3"},{"name":"系列B","values":"4,5,6"}]'
 *
 * 用法二（完整 JSON 配置）：
 *   <div data-plotly-config='{"data":[...],"layout":{...}}'
 *        style="flex:1; min-height:0"></div>
 *
 * 依赖：index.html 中需先加载 Plotly CDN
 */
const PlotlyCharts = (() => {
  const PLOTLY_CDN = 'https://cdn.plot.ly/plotly-2.35.2.min.js';

  /* ── 读取 CSS 变量 ── */
  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /* ── 通用 layout 基础配置（自动适配当前主题） ── */
  function baseLayout(overrides = {}) {
    const muted  = css('--muted')  || '#888';
    const border = css('--border') || '#ddd';
    const text   = css('--text')   || '#333';
    const font   = css('--font-body') || 'Inter, system-ui, sans-serif';

    return {
      paper_bgcolor: 'transparent',
      plot_bgcolor:  'transparent',
      font: { family: font, color: text, size: 22 },
      margin: { t: 40, r: 32, b: 72, l: 72, pad: 4 },
      xaxis: {
        gridcolor: border, linecolor: border, zerolinecolor: border,
        tickfont: { color: muted, size: 22 },
      },
      yaxis: {
        gridcolor: border, linecolor: border, zerolinecolor: border,
        tickfont: { color: muted, size: 22 },
        gridwidth: 1,
      },
      showlegend: false,
      ...overrides,
    };
  }

  /* ── 从 CSS 变量生成调色板 ── */
  function palette(n = 1) {
    const accent = css('--accent') || '#4f8ef7';
    // 利用 accent 生成同色系多色
    const colors = [accent];
    // 额外备用色：用 accent 的兄弟色（如果只有一个系列直接用 accent）
    const fallbacks = [
      accent,
      css('--accent-2') || '#f7834f',
      css('--accent-3') || '#4ff79e',
      css('--muted')    || '#aaa',
    ];
    for (let i = 0; i < n; i++) colors[i] = fallbacks[i % fallbacks.length];
    return colors;
  }

  /* ── 构建单系列 trace ── */
  function buildTrace(type, labels, values, color, name) {
    const base = { name: name || '', hovertemplate: '%{y}<extra></extra>' };

    if (type === 'bar') {
      return {
        ...base, type: 'bar', x: labels, y: values,
        marker: { color, opacity: 0.88, line: { width: 0 } },
      };
    }
    if (type === 'line') {
      return {
        ...base, type: 'scatter', mode: 'lines+markers',
        x: labels, y: values,
        line: { color, width: 3, shape: 'spline' },
        marker: { color, size: 7, line: { color: 'rgba(255,255,255,0.6)', width: 2 } },
      };
    }
    if (type === 'area') {
      return {
        ...base, type: 'scatter', mode: 'lines',
        x: labels, y: values,
        line: { color, width: 2.5, shape: 'spline' },
        fill: 'tozeroy', fillcolor: color + '22',
      };
    }
    if (type === 'scatter') {
      return {
        ...base, type: 'scatter', mode: 'markers',
        x: labels, y: values,
        marker: { color, size: 10, opacity: 0.8 },
      };
    }
    if (type === 'pie') {
      const colors = values.map((_, i) => {
        const h = (i * 47) % 360;
        return `hsl(${h},65%,55%)`;
      });
      return {
        type: 'pie', labels, values,
        marker: { colors },
        hole: 0.4,
        textfont: { color: css('--text') || '#333' },
        hovertemplate: '%{label}: %{value}<extra></extra>',
      };
    }
    return null;
  }

  /* ── 初始化单个元素（数据属性模式） ── */
  function initAttr(el) {
    const type   = el.dataset.plotly;
    const labels = el.dataset.labels ? el.dataset.labels.split(',') : [];
    const title  = el.dataset.title  || '';
    const yTitle = el.dataset.yTitle || el.dataset.ytitle || '';
    const colors = palette(8);

    let traces = [];

    // 多系列模式：data-series='[{"name":"A","values":"1,2,3"},...]'
    if (el.dataset.series) {
      try {
        const series = JSON.parse(el.dataset.series);
        traces = series.map((s, i) => {
          const vals = (s.values || '').split(',').map(Number).filter(n => !isNaN(n));
          const lbs  = s.labels ? s.labels.split(',') : labels;
          return buildTrace(type, lbs, vals, colors[i % colors.length], s.name);
        }).filter(Boolean);
        if (traces.length > 1) {
          traces.forEach(t => { /* showlegend 由 layout 控制 */ });
        }
      } catch (e) {
        console.error('[PlotlyCharts] data-series JSON 解析失败', e);
      }
    }

    // 单系列模式：data-values="..."
    if (!traces.length) {
      const values = (el.dataset.values || '').split(',').map(Number).filter(n => !isNaN(n));
      if (!values.length) return;
      const lbs = labels.length ? labels : values.map((_, i) => i + 1);
      const t = buildTrace(type, lbs, values, colors[0]);
      if (t) traces = [t];
    }

    if (!traces.length) return;

    const hasMulti = traces.length > 1;
    const layout = baseLayout({
      title: title ? { text: title, font: { size: 24 }, x: 0.02 } : undefined,
      yaxis: {
        ...baseLayout().yaxis,
        title: yTitle ? { text: yTitle, font: { size: 22 } } : undefined,
      },
      showlegend: hasMulti,
      legend: hasMulti ? {
        orientation: 'h', x: 0, y: -0.18,
        font: { size: 20, color: css('--muted') || '#888' },
      } : false,
      barmode: (type === 'bar' && hasMulti) ? 'group' : undefined,
    });

    Plotly.newPlot(el, traces, layout, {
      responsive: true,
      displayModeBar: false,
      staticPlot: true,
    });
  }

  /* ── 初始化单个元素（完整 JSON 配置模式） ── */
  function initConfig(el) {
    try {
      const cfg    = JSON.parse(el.dataset.plotlyConfig);
      const layout = { ...baseLayout(), ...(cfg.layout || {}) };
      Plotly.newPlot(el, cfg.data || [], layout, {
        responsive: true,
        displayModeBar: false,
        ...(cfg.config || {}),
      });
    } catch (e) {
      console.error('[PlotlyCharts] data-plotly-config 解析失败', e);
    }
  }

  /* ── 扫描页面，初始化所有未处理元素 ── */
  function init() {
    if (typeof Plotly === 'undefined') return;

    document.querySelectorAll('[data-plotly]:not([data-plotly-done])').forEach(el => {
      el.setAttribute('data-plotly-done', '1');
      initAttr(el);
    });

    document.querySelectorAll('[data-plotly-config]:not([data-plotly-done])').forEach(el => {
      el.setAttribute('data-plotly-done', '1');
      initConfig(el);
    });
  }

  /* ── slide-change 时 resize 当前页图表（确保尺寸正确） ── */
  function resizeActive() {
    if (typeof Plotly === 'undefined') return;
    const active = document.querySelector('#deck .slide.active');
    if (!active) return;
    active.querySelectorAll('[data-plotly-done]').forEach(el => {
      try { Plotly.Plots.resize(el); } catch (_) {}
    });
  }

  window.addEventListener('pres-ready',   () => { init(); resizeActive(); });
  window.addEventListener('slide-change', () => { init(); resizeActive(); });

  return { init, resizeActive };
})();
