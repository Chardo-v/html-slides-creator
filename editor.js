(function () {

  // ═══════════════════════════════════════════════════════════
  //  状态
  // ═══════════════════════════════════════════════════════════
  let editMode  = false;
  let dirty     = false;
  let autoSaveTimer  = null;
  let textEditTimer  = null;

  // ═══════════════════════════════════════════════════════════
  //  历史记录
  // ═══════════════════════════════════════════════════════════
  let hist    = [];   // [{ time, name, state: [innerHTML...] }]
  let histPos = -1;

  function snapshot() {
    return [...document.querySelectorAll('.slide')].map(s => s.innerHTML);
  }

  function addHistory(name) {
    // 截断当前位置之后的记录（新操作后不能再 redo）
    hist = hist.slice(0, histPos + 1);
    hist.push({ time: new Date(), name, state: snapshot() });
    if (hist.length > 60) hist.shift();
    histPos = hist.length - 1;
    buildHistoryList();
    triggerAutoSave();
  }

  function restoreToPos(pos) {
    if (pos < 0 || pos >= hist.length) return;
    const entry = hist[pos];
    document.querySelectorAll('.slide').forEach((s, i) => {
      s.innerHTML = entry.state[i] ?? s.innerHTML;
    });
    histPos = pos;
    deselect();
    buildHistoryList();
    triggerAutoSave();
  }

  function undo() { restoreToPos(histPos - 1); }
  function redo() { restoreToPos(histPos + 1); }

  function formatTime(d) {
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  }

  function buildHistoryList() {
    const el = document.getElementById('history-list');
    if (!el) return;
    el.innerHTML = '';
    [...hist].reverse().forEach((h, ri) => {
      const pos = hist.length - 1 - ri;
      const btn = document.createElement('button');
      btn.className = 'hist-item' + (pos === histPos ? ' cur' : '') + (pos > histPos ? ' future' : '');
      btn.innerHTML = `<span class="hist-time">${formatTime(h.time)}</span><span class="hist-name">${h.name}</span>`;
      btn.addEventListener('click', () => restoreToPos(pos));
      el.appendChild(btn);
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  自然拖拽 & 缩放（无手柄，直接按住元素移动）
  // ═══════════════════════════════════════════════════════════
  let selTarget   = null;       // 单选目标（有 overlay 手柄）
  let selTargets  = new Set();  // 全部已选元素
  let pendingDrag = null;       // 等待判断是点击还是拖拽
  let marqueeDrag = null;       // 框选拖拽

  const DRAG_THRESHOLD = 6;    // px，超过此距离才判定为拖拽
  const MIN_SCALE      = 0.05; // 元素最小缩放倍数
  const MIN_EL_W       = 20;   // 元素最小宽度 px
  const MIN_EL_H       = 10;   // 元素最小高度 px

  // 框选矩形
  const marqueeEl = document.createElement('div');
  marqueeEl.id = 'sel-marquee';
  document.body.appendChild(marqueeEl);

  // 选中覆盖层：右下角缩放、左下角旋转、四边拉伸、右上角重置
  const ov = document.createElement('div');
  ov.id = 'sel-overlay';
  ov.innerHTML = `
    <div class="sel-rotate" title="旋转"></div>
    <div class="sel-resize" title="缩放"></div>
    <button class="sel-reset" title="重置变换 (↺)">↺</button>
    <div class="sel-edge sel-edge-t" data-dir="t"></div>
    <div class="sel-edge sel-edge-b" data-dir="b"></div>
    <div class="sel-edge sel-edge-l" data-dir="l"></div>
    <div class="sel-edge sel-edge-r" data-dir="r"></div>
  `;
  document.body.appendChild(ov);

  function getTransform(el) {
    const t = el.style.transform || '';
    const m = t.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
    const r = t.match(/rotate\(([-\d.]+)deg\)/);
    const s = t.match(/scale\(([-\d.]+)(?:,\s*([-\d.]+))?\)/);
    return {
      tx:  m ? +m[1] : 0,
      ty:  m ? +m[2] : 0,
      rot: r ? +r[1] : 0,
      sx:  s ? +s[1] : 1,
      sy:  s ? +(s[2] !== undefined ? s[2] : s[1]) : 1,
    };
  }
  function setTransform(el, tx, ty, rot, sx, sy) {
    el.style.transform       = `translate(${tx}px,${ty}px) rotate(${rot}deg) scale(${sx},${sy})`;
    el.style.transformOrigin = 'center center';
  }

  // 用元素中心 + 自然尺寸 × scale 来定位覆盖层，并附带旋转
  function positionOv() {
    if (!selTarget) return;
    const { rot, sx, sy } = getTransform(selTarget);
    const ds = getDeckScale();
    const r  = selTarget.getBoundingClientRect();
    const cx = r.left + r.width  / 2;
    const cy = r.top  + r.height / 2;
    const nw = selTarget.offsetWidth  * Math.abs(sx) * ds;
    const nh = selTarget.offsetHeight * Math.abs(sy) * ds;
    Object.assign(ov.style, {
      left:      (cx - nw / 2) + 'px',
      top:       (cy - nh / 2) + 'px',
      width:     nw + 'px',
      height:    nh + 'px',
      transform: `rotate(${rot}deg)`,
    });
  }

  function selectEl(el) {
    deselect();
    selTarget = el;
    selTargets.add(el);
    el.classList.add('edit-selected');
    document.body.classList.remove('multi-select');
    positionOv();
    ov.style.display = 'block';
  }

  function selectMultiple(elements) {
    deselect();
    elements.forEach(el => { el.classList.add('edit-selected'); selTargets.add(el); });
    if (selTargets.size === 1) {
      selTarget = elements[0];
      document.body.classList.remove('multi-select');
      positionOv();
      ov.style.display = 'block';
    } else if (selTargets.size > 1) {
      document.body.classList.add('multi-select');
    }
  }

  function deselect() {
    selTargets.forEach(el => el.classList.remove('edit-selected'));
    selTargets.clear();
    selTarget = null;
    ov.style.display = 'none';
    document.body.classList.remove('multi-select');
  }

  // Cmd/Ctrl + 单击：切换该元素的选中状态
  function toggleSelect(el) {
    if (selTargets.has(el)) {
      el.classList.remove('edit-selected');
      selTargets.delete(el);
      if (selTargets.size === 0) {
        deselect();
      } else if (selTargets.size === 1) {
        selTarget = [...selTargets][0];
        document.body.classList.remove('multi-select');
        positionOv();
        ov.style.display = 'block';
      }
    } else {
      if (selTarget) { ov.style.display = 'none'; selTarget = null; }
      el.classList.add('edit-selected');
      selTargets.add(el);
      document.body.classList.add('multi-select');
    }
  }

  const LAYOUT_CLS = [
    // 顶层布局容器
    '.slide-content', '.slide-center',
    '.layout-hero', '.layout-quote',
    '.layout-image-right', '.layout-image-left',
    '.layout-stats', '.layout-timeline',
    '.layout-dashboard',
    // 列 / 分区容器
    '.col', '.col-wide', '.two-col',
    '.text-col', '.img-col',
    '.dashboard-header', '.dashboard-body', '.dashboard-right', '.dashboard-stats',
    // 内容组容器
    '.grid', '.stats-row', '.steps', '.compare', '.timeline',
  ];
  function findSelectable(target, slide) {
    let el = target;
    while (el && el !== slide) {
      const p = el.parentElement;
      if (!p) break;
      if (p === slide || LAYOUT_CLS.some(s => p.matches(s))) {
        if (LAYOUT_CLS.some(s => el.matches(s))) return null;
        return el;
      }
      el = p;
    }
    return null;
  }

  // 遍历 slide，收集所有可选中的叶子元素（与 findSelectable 逻辑一致）
  function getAllSelectableElements(slide) {
    const isLayout = el => LAYOUT_CLS.some(s => el.matches(s));
    const result = [];
    function walk(parent) {
      for (const child of parent.children) {
        if (isLayout(child)) { walk(child); }
        else if (parent === slide || isLayout(parent)) { result.push(child); }
      }
    }
    walk(slide);
    return result;
  }

  // ── 右下角：等比缩放 ──
  let resizeDrag = null;
  ov.querySelector('.sel-resize').addEventListener('mousedown', e => {
    e.preventDefault(); e.stopPropagation();
    if (!selTarget) return;
    const { tx, ty, rot, sx, sy } = getTransform(selTarget);
    const r  = selTarget.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top  + r.height / 2;
    resizeDrag = { tx, ty, rot, startSx: sx, startSy: sy, cx, cy,
                   startX: e.clientX, startY: e.clientY };
  });

  // ── 左下角：旋转 ──
  let rotateDrag = null;
  ov.querySelector('.sel-rotate').addEventListener('mousedown', e => {
    e.preventDefault(); e.stopPropagation();
    if (!selTarget) return;
    const { tx, ty, rot, sx, sy } = getTransform(selTarget);
    const r  = selTarget.getBoundingClientRect();
    const cx = r.left + r.width  / 2;
    const cy = r.top  + r.height / 2;
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
    rotateDrag = { tx, ty, startRot: rot, sx, sy, cx, cy, startAngle };
  });

  // ── 四边：单轴拉伸 ──
  let edgeDrag = null;
  ov.querySelectorAll('.sel-edge').forEach(handle => {
    handle.addEventListener('mousedown', e => {
      e.preventDefault(); e.stopPropagation();
      if (!selTarget) return;
      const { tx, ty, rot, sx, sy } = getTransform(selTarget);
      edgeDrag = {
        dir: handle.dataset.dir, tx, ty, rot,
        startSx: sx, startSy: sy,
        startX: e.clientX, startY: e.clientY,
        naturalW: selTarget.offsetWidth,
        naturalH: selTarget.offsetHeight,
      };
    });
  });

  // ── 重置 ──
  ov.querySelector('.sel-reset').addEventListener('click', e => {
    e.stopPropagation();
    if (!selTarget) return;
    selTarget.style.transform = '';
    selTarget.style.transformOrigin = '';
    positionOv();
    addHistory(`重置 第${cur+1}页 ${selTarget.tagName.toLowerCase()}`);
  });

  // 点击幻灯片内元素 → 标记 pendingDrag；点击背景 → 启动框选
  document.addEventListener('mousedown', e => {
    if (!editMode) return;
    if (e.target.closest('#sel-overlay') || e.target.closest('#panel') || e.target.closest('#btn-edit')) return;
    const slide = document.querySelector('.slide.active');
    if (!slide || !slide.contains(e.target)) { deselect(); return; }
    const target = findSelectable(e.target, slide);
    if (!target) {
      // 点击背景 → 启动框选，阻止 contentEditable 的原生文字选中
      e.preventDefault();
      deselect();
      marqueeDrag = { startX: e.clientX, startY: e.clientY, slide };
      Object.assign(marqueeEl.style, { left: e.clientX + 'px', top: e.clientY + 'px', width: '0', height: '0', display: 'block' });
      return;
    }
    // Cmd/Ctrl + 单击 → 切换多选
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      toggleSelect(target);
      return;
    }
    // 点击已选中的元素 → 直接进入组合移动；否则先单选
    if (!selTargets.has(target)) selectEl(target);
    // 记录所有选中元素的初始 transform，用于组合移动
    const group = [...selTargets].map(el => ({ el, ...getTransform(el) }));
    pendingDrag = { group, primary: target, startX: e.clientX, startY: e.clientY, isDragging: false };
  });

  // ── 各拖拽模式的处理函数 ──

  function handleResizeDrag(e) {
    const dist      = Math.hypot(e.clientX - resizeDrag.cx, e.clientY - resizeDrag.cy);
    const startDist = Math.hypot(resizeDrag.startX - resizeDrag.cx, resizeDrag.startY - resizeDrag.cy);
    const factor    = dist / Math.max(startDist, 1);
    const newSx     = Math.max(MIN_SCALE, resizeDrag.startSx * factor);
    const newSy     = Math.max(MIN_SCALE, resizeDrag.startSy * factor);
    setTransform(selTarget, resizeDrag.tx, resizeDrag.ty, resizeDrag.rot, newSx, newSy);
    positionOv();
  }

  function handleRotateDrag(e) {
    const angle = Math.atan2(e.clientY - rotateDrag.cy, e.clientX - rotateDrag.cx) * 180 / Math.PI;
    const rot   = rotateDrag.startRot + (angle - rotateDrag.startAngle);
    setTransform(selTarget, rotateDrag.tx, rotateDrag.ty, rot, rotateDrag.sx, rotateDrag.sy);
    positionOv();
  }

  function handleEdgeDrag(e) {
    const dx  = e.clientX - edgeDrag.startX;
    const dy  = e.clientY - edgeDrag.startY;
    const ds  = getDeckScale();
    // 将屏幕位移投影到元素本地坐标系（补偿旋转）
    const rad = edgeDrag.rot * Math.PI / 180;
    const lx  = ( dx * Math.cos(rad) + dy * Math.sin(rad)) / ds;
    const ly  = (-dx * Math.sin(rad) + dy * Math.cos(rad)) / ds;
    let sx = edgeDrag.startSx, sy = edgeDrag.startSy;
    if (edgeDrag.dir === 'l' || edgeDrag.dir === 'r') {
      const sign  = edgeDrag.dir === 'r' ? 1 : -1;
      const newW  = Math.max(MIN_EL_W, edgeDrag.naturalW * edgeDrag.startSx + sign * lx * 2);
      sx = newW / edgeDrag.naturalW;
    } else {
      const sign  = edgeDrag.dir === 'b' ? 1 : -1;
      const newH  = Math.max(MIN_EL_H, edgeDrag.naturalH * edgeDrag.startSy + sign * ly * 2);
      sy = newH / edgeDrag.naturalH;
    }
    setTransform(selTarget, edgeDrag.tx, edgeDrag.ty, edgeDrag.rot, sx, sy);
    positionOv();
  }

  function handleMarqueeDraw(e) {
    window.getSelection()?.removeAllRanges();
    const x = Math.min(e.clientX, marqueeDrag.startX);
    const y = Math.min(e.clientY, marqueeDrag.startY);
    Object.assign(marqueeEl.style, {
      left: x + 'px', top: y + 'px',
      width:  Math.abs(e.clientX - marqueeDrag.startX) + 'px',
      height: Math.abs(e.clientY - marqueeDrag.startY) + 'px',
    });
  }

  function handleMoveDrag(e) {
    if (!pendingDrag) return;
    const dx = e.clientX - pendingDrag.startX;
    const dy = e.clientY - pendingDrag.startY;
    if (!pendingDrag.isDragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      pendingDrag.isDragging = true;
      window.getSelection()?.removeAllRanges();
      document.activeElement?.blur();
    }
    if (pendingDrag.isDragging) {
      const ds = getDeckScale();
      pendingDrag.group.forEach(({ el, tx, ty, rot, sx, sy }) => {
        setTransform(el, tx + dx / ds, ty + dy / ds, rot, sx, sy);
      });
      if (selTarget) positionOv();
    }
  }

  document.addEventListener('mousemove', e => {
    if (resizeDrag && selTarget) return handleResizeDrag(e);
    if (rotateDrag && selTarget) return handleRotateDrag(e);
    if (edgeDrag   && selTarget) return handleEdgeDrag(e);
    if (marqueeDrag)             return handleMarqueeDraw(e);
    handleMoveDrag(e);
  });

  document.addEventListener('mouseup', e => {
    if (resizeDrag) { resizeDrag = null; if (selTarget) addHistory(`缩放 第${cur+1}页`); }
    if (rotateDrag) { rotateDrag = null; if (selTarget) addHistory(`旋转 第${cur+1}页`); }
    if (edgeDrag)   { edgeDrag   = null; if (selTarget) addHistory(`拉伸 第${cur+1}页`); }
    if (marqueeDrag) {
      marqueeEl.style.display = 'none';
      const mx1 = Math.min(e.clientX, marqueeDrag.startX);
      const my1 = Math.min(e.clientY, marqueeDrag.startY);
      const mx2 = Math.max(e.clientX, marqueeDrag.startX);
      const my2 = Math.max(e.clientY, marqueeDrag.startY);
      // 只有拖出了一定面积才执行框选
      if (mx2 - mx1 > 4 && my2 - my1 > 4) {
        const hits = getAllSelectableElements(marqueeDrag.slide).filter(el => {
          const r = el.getBoundingClientRect();
          return r.left >= mx1 && r.right <= mx2 && r.top >= my1 && r.bottom <= my2;
        });
        selectMultiple(hits);
      }
      marqueeDrag = null;
    }
    if (pendingDrag) {
      if (pendingDrag.isDragging) addHistory(`移动 第${cur+1}页`);
      pendingDrag = null;
    }
  });

  window.addEventListener('resize', positionOv);

  // ═══════════════════════════════════════════════════════════
  //  等比例缩放
  // ═══════════════════════════════════════════════════════════
  const BASE_DECK_W = 1600;

  function updateDeckScale() {
    const stage = document.getElementById('stage');
    const deck  = document.getElementById('deck');
    if (!stage || !deck) return;
    const stageW = stage.offsetWidth;
    const stageH = stage.offsetHeight;
    const ar = getComputedStyle(document.documentElement)
      .getPropertyValue('--aspect-ratio').trim() || '16/9';
    const parts = ar.split('/');
    const rw = parseFloat(parts[0]) || 16;
    const rh = parseFloat(parts[1]) || 9;
    const baseH = BASE_DECK_W * rh / rw;
    const scale = Math.min(stageW / BASE_DECK_W, stageH / baseH);
    document.documentElement.style.setProperty('--deck-scale', scale);
  }

  // ResizeObserver 监听 stage（含 transition 动画过程中的持续更新）
  (function initScaleObserver() {
    const stage = document.getElementById('stage');
    if (window.ResizeObserver) {
      new ResizeObserver(updateDeckScale).observe(stage);
    } else {
      window.addEventListener('resize', updateDeckScale);
    }
  })();

  function getDeckScale() {
    return parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--deck-scale')
    ) || 1;
  }

  // ═══════════════════════════════════════════════════════════
  //  面板 & 全屏
  // ═══════════════════════════════════════════════════════════
  function setPanel(open) {
    document.body.classList.toggle('edit-mode', open);
    editMode = open;
    document.querySelectorAll('.slide').forEach(s => {
      s.contentEditable = open ? 'true' : 'false';
    });
    if (!open) deselect();
  }

  function enterPresentation() {
    setPanel(false);
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) setPanel(true);
  });

  // ═══════════════════════════════════════════════════════════
  //  比例设置
  // ═══════════════════════════════════════════════════════════
  function applyRatio(ratio) {
    const [rw, rh] = ratio.split(':');
    document.documentElement.style.setProperty('--aspect-ratio', `${rw}/${rh}`);
    localStorage.setItem('pres-aspect-ratio', ratio);
    document.querySelectorAll('.ratio-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.ratio === ratio)
    );
    updateDeckScale();
  }

  // ═══════════════════════════════════════════════════════════
  //  构建面板 UI
  // ═══════════════════════════════════════════════════════════
  function buildThemes() {
    const el = document.getElementById('theme-swatches');
    THEMES.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'theme-card'; btn.dataset.id = t.id;
      btn.innerHTML = `<div class="th-dots">${t.swatches.map(c =>
        `<span style="background:${c}"></span>`).join('')}</div><span class="th-name">${t.name}</span>`;
      btn.addEventListener('click', () => { applyTheme(t.id); addHistory(`切换主题: ${t.name}`); });
      el.appendChild(btn);
    });
  }

  function buildTrans() {
    const el    = document.getElementById('trans-options');
    const saved = localStorage.getItem('pres-transition') || 'slide';
    [['slide','推入'], ['fade','淡化'], ['zoom','缩放']].forEach(([val, label]) => {
      const btn = document.createElement('button');
      btn.className = 'trans-btn' + (val === saved ? ' active' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => {
        document.body.dataset.transition = val;
        localStorage.setItem('pres-transition', val);
        el.querySelectorAll('.trans-btn').forEach(b => b.classList.toggle('active', b === btn));
      });
      el.appendChild(btn);
    });
  }

  function buildSlideList() {
    const el = document.getElementById('slide-nav');
    if (!el) return;
    el.innerHTML = '';
    SLIDES.forEach((path, i) => {
      const name = path.split('/').slice(-2, -1)[0].replace(/^\d+-/, '').replace(/-/g, ' ');
      const btn  = document.createElement('button');
      btn.className = 'slide-item' + (i === cur ? ' cur' : '');
      btn.innerHTML = `<span class="si-num">${String(i+1).padStart(2,'0')}</span><span class="si-name">${name}</span>`;
      btn.addEventListener('click', () => go(i));
      el.appendChild(btn);
    });
  }

  function buildRatioBtns() {
    const saved = localStorage.getItem('pres-aspect-ratio') || GLOBAL_CONFIG.aspectRatio || '16:9';
    document.querySelectorAll('.ratio-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.ratio === saved);
      btn.addEventListener('click', () => applyRatio(btn.dataset.ratio));
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  保存 / 重置 / 自动保存
  // ═══════════════════════════════════════════════════════════
  function saveAll() {
    document.querySelectorAll('.slide').forEach((s, i) =>
      localStorage.setItem(`pres-slide-${i}`, s.innerHTML)
    );
    markClean();
    toast('已保存 ✓');
  }

  function resetCurrent() {
    localStorage.removeItem(`pres-slide-${cur}`);
    fetch(SLIDES[cur])
      .then(r => r.text())
      .then(html => {
        document.querySelectorAll('.slide')[cur].innerHTML = html;
        deselect();
        addHistory(`重置 第${cur+1}页`);
        toast('已重置');
      })
      .catch(err => {
        console.error('重置失败:', err);
        toast('重置失败 ✗');
      });
  }

  function loadSaved() {
    document.querySelectorAll('.slide').forEach((s, i) => {
      const saved = localStorage.getItem(`pres-slide-${i}`);
      if (saved) s.innerHTML = saved;
    });
  }

  function markDirty() {
    if (dirty) return; dirty = true;
    document.getElementById('btn-save').textContent = '● 保存编辑';
  }
  function markClean() {
    dirty = false;
    document.getElementById('btn-save').textContent = '💾 保存所有编辑';
  }
  function triggerAutoSave() {
    markDirty();
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(saveAll, 2000);
  }

  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2200);
  }

  // ═══════════════════════════════════════════════════════════
  //  初始化
  // ═══════════════════════════════════════════════════════════
  window.addEventListener('pres-ready', () => {
    buildThemes();
    buildTrans();
    buildRatioBtns();
    buildSlideList();
    loadSaved();
    applyTheme(localStorage.getItem('pres-theme') || 'dawn');
    document.body.dataset.transition = localStorage.getItem('pres-transition') || 'slide';
    updateDeckScale();
    setPanel(true);
    // 记录初始状态
    addHistory('初始状态');
  });

  window.onSlideChange = () => { buildSlideList(); deselect(); };

  // ═══════════════════════════════════════════════════════════
  //  事件绑定
  // ═══════════════════════════════════════════════════════════
  document.getElementById('btn-present').addEventListener('click', enterPresentation);
  document.getElementById('btn-edit').addEventListener('click',    () => setPanel(true));
  document.getElementById('btn-save').addEventListener('click',    saveAll);
  document.getElementById('btn-reset').addEventListener('click',   resetCurrent);

  document.addEventListener('keydown', e => {
    // Ctrl/Cmd + Z → undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); toast('撤销 ↩'); return; }
    // Ctrl/Cmd + Shift + Z  or Ctrl+Y → redo
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); toast('重做 ↪'); return; }
    // Ctrl/Cmd + S → save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveAll(); return; }
    if (e.target.isContentEditable) return;
    // Esc → 退出编辑模式
    if (e.key === 'Escape' && editMode) { setPanel(false); return; }
    // E → 切换编辑面板
    if ((e.key === 'e' || e.key === 'E') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      setPanel(!editMode);
      return;
    }
  });

  // 文字编辑：防抖后记录历史
  document.addEventListener('input', e => {
    if (!editMode || !e.target.isContentEditable) return;
    clearTimeout(textEditTimer);
    textEditTimer = setTimeout(() => addHistory(`编辑 第${cur+1}页 文本`), 1500);
    triggerAutoSave();
  });
})();
