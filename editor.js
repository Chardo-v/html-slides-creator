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
  let selTarget   = null;
  let pendingDrag = null;  // 等待判断是点击还是拖拽

  const DRAG_THRESHOLD = 6; // px，超过此距离才判定为拖拽

  // 选中覆盖层（只保留边框 + 缩放手柄 + 重置按钮）
  const ov = document.createElement('div');
  ov.id = 'sel-overlay';
  ov.innerHTML = `
    <div class="sel-info"></div>
    <div class="sel-resize" title="拖动缩放"></div>
    <button class="sel-reset" title="重置变换 (↺)">↺</button>
  `;
  document.body.appendChild(ov);

  function getTransform(el) {
    const t = el.style.transform || '';
    const m = t.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
    const s = t.match(/scale\(([-\d.]+)\)/);
    return { tx: m ? +m[1] : 0, ty: m ? +m[2] : 0, scale: s ? +s[1] : 1 };
  }
  function setTransform(el, tx, ty, scale) {
    el.style.transform       = `translate(${tx}px,${ty}px) scale(${scale})`;
    el.style.transformOrigin = 'center center';
  }

  function positionOv() {
    if (!selTarget) return;
    const r = selTarget.getBoundingClientRect();
    Object.assign(ov.style, {
      left: r.left + 'px', top: r.top + 'px',
      width: r.width + 'px', height: r.height + 'px',
    });
    ov.querySelector('.sel-info').textContent =
      selTarget.className ? `.${selTarget.className.split(' ')[0]}` : selTarget.tagName.toLowerCase();
  }

  function selectEl(el) {
    if (selTarget) selTarget.classList.remove('edit-selected');
    selTarget = el;
    el.classList.add('edit-selected');
    positionOv();
    ov.style.display = 'block';
  }

  function deselect() {
    if (selTarget) selTarget.classList.remove('edit-selected');
    selTarget = null;
    ov.style.display = 'none';
  }

  const LAYOUT_CLS = [
    '.slide-content', '.slide-center', '.layout-hero', '.layout-quote',
    '.layout-image-right', '.layout-image-left', '.layout-stats', '.layout-timeline',
    '.col', '.col-wide', '.grid', '.stats-row', '.steps', '.compare', '.timeline',
  ];
  function findSelectable(target, slide) {
    let el = target;
    while (el && el !== slide) {
      const p = el.parentElement;
      if (!p) break;
      if (p === slide || LAYOUT_CLS.some(s => p.matches(s))) return el;
      el = p;
    }
    return slide.firstElementChild || null;
  }

  // 缩放手柄 drag
  let resizeDrag = null;
  ov.querySelector('.sel-resize').addEventListener('mousedown', e => {
    e.preventDefault(); e.stopPropagation();
    if (!selTarget) return;
    const { tx, ty, scale } = getTransform(selTarget);
    const r = selTarget.getBoundingClientRect();
    resizeDrag = { startX: e.clientX, startY: e.clientY, tx, ty, startScale: scale, ox: r.left, oy: r.top };
  });

  // 重置
  ov.querySelector('.sel-reset').addEventListener('click', e => {
    e.stopPropagation();
    if (!selTarget) return;
    selTarget.style.transform = '';
    selTarget.style.transformOrigin = '';
    positionOv();
    addHistory(`重置 第${cur+1}页 ${selTarget.tagName.toLowerCase()}`);
  });

  // 点击幻灯片内元素 → 标记 pendingDrag
  document.addEventListener('mousedown', e => {
    if (!editMode) return;
    if (e.target.closest('#sel-overlay') || e.target.closest('#panel') || e.target.closest('#btn-edit')) return;
    const slide = document.querySelector('.slide.active');
    if (!slide || !slide.contains(e.target)) { deselect(); return; }
    const target = findSelectable(e.target, slide);
    if (!target) return;
    if (target !== selTarget) selectEl(target);
    const { tx, ty, scale } = getTransform(target);
    pendingDrag = { el: target, startX: e.clientX, startY: e.clientY, startTx: tx, startTy: ty, scale, isDragging: false };
  });

  document.addEventListener('mousemove', e => {
    // 缩放拖拽（resize handle）
    if (resizeDrag && selTarget) {
      const dist = Math.hypot(e.clientX - resizeDrag.ox, e.clientY - resizeDrag.oy);
      const startDist = Math.hypot(resizeDrag.startX - resizeDrag.ox, resizeDrag.startY - resizeDrag.oy);
      const newScale = Math.max(0.15, resizeDrag.startScale * (dist / Math.max(startDist, 1)));
      setTransform(selTarget, resizeDrag.tx, resizeDrag.ty, newScale);
      positionOv();
      return;
    }
    // 移动拖拽
    if (!pendingDrag) return;
    const dx = e.clientX - pendingDrag.startX;
    const dy = e.clientY - pendingDrag.startY;
    if (!pendingDrag.isDragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      pendingDrag.isDragging = true;
      window.getSelection()?.removeAllRanges();
      document.activeElement?.blur();
    }
    if (pendingDrag.isDragging) {
      setTransform(pendingDrag.el, pendingDrag.startTx + dx, pendingDrag.startTy + dy, pendingDrag.scale);
      positionOv();
    }
  });

  document.addEventListener('mouseup', () => {
    if (resizeDrag) {
      resizeDrag = null;
      if (selTarget) addHistory(`缩放 第${cur+1}页 ${selTarget.tagName.toLowerCase()}`);
    }
    if (pendingDrag) {
      if (pendingDrag.isDragging) addHistory(`移动 第${cur+1}页 ${pendingDrag.el.tagName.toLowerCase()}`);
      pendingDrag = null;
    }
  });

  window.addEventListener('resize', positionOv);

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
    fetch(SLIDES[cur]).then(r => r.text()).then(html => {
      document.querySelectorAll('.slide')[cur].innerHTML = html;
      deselect();
      addHistory(`重置 第${cur+1}页`);
      toast('已重置');
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
    // Esc → 退出编辑模式（演示模式不支持 E 键重新进入）
    if (e.key === 'Escape' && editMode) { setPanel(false); return; }
  });

  // 文字编辑：防抖后记录历史
  document.addEventListener('input', e => {
    if (!editMode || !e.target.isContentEditable) return;
    clearTimeout(textEditTimer);
    textEditTimer = setTimeout(() => addHistory(`编辑 第${cur+1}页 文本`), 1500);
    triggerAutoSave();
  });
})();
