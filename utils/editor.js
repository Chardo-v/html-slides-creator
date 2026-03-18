(function () {

  // ═══════════════════════════════════════════════════════════
  //  状态
  // ═══════════════════════════════════════════════════════════
  let editMode  = false;
  let dirty     = false;
  let autoSaveTimer  = null;
  let textEditTimer  = null;
  let nudgeTimer     = null;
  let knownMtimes    = {};   // path → mtime（防止将自己的写操作误判为外部改动）

  // ═══════════════════════════════════════════════════════════
  //  剪贴板（复制 / 粘贴）
  // ═══════════════════════════════════════════════════════════
  const PASTE_OFFSET = 24; // 粘贴偏移 px（幻灯片坐标系）
  let clipboard = []; // [{ html, parent }]

  function copySelected() {
    if (!selTargets.size) return;
    clipboard = [...selTargets].map(el => ({ html: el.outerHTML, parent: el.parentElement }));
    toast(`已复制 ${clipboard.length} 个元素`);
  }

  function findPasteParent(slide, originalParent) {
    if (slide.contains(originalParent)) return originalParent;
    // 按第一个 class 名在当前 slide 里找同类容器
    const cls = [...originalParent.classList][0];
    if (cls) { const found = slide.querySelector('.' + cls); if (found) return found; }
    // 降级：找第一个布局容器
    return slide.querySelector('.slide-content,.slide-center,.layout-hero,.text-col') || slide;
  }

  function pasteClipboard() {
    if (!clipboard.length) return;
    const slide = document.querySelector('.slide.active');
    if (!slide) return;
    const newEls = [];
    clipboard.forEach(({ html, parent }) => {
      const wrap = document.createElement('div');
      wrap.innerHTML = html;
      const newEl = wrap.firstElementChild;
      if (!newEl) return;
      const { tx, ty, rot, sx, sy } = getTransform(newEl);
      setTransform(newEl, tx + PASTE_OFFSET, ty + PASTE_OFFSET, rot, sx, sy);
      findPasteParent(slide, parent).appendChild(newEl);
      newEls.push(newEl);
    });
    if (newEls.length) {
      // 先清除选中样式，再只选新元素（原元素不动）
      selTargets.forEach(el => el.classList.remove('edit-selected'));
      selTargets.clear();
      selTarget = null;
      ov.style.display = 'none';
      document.body.classList.remove('multi-select');
      selectMultiple(newEls);
      addHistory(`粘贴 第${cur+1}页`);
      toast(`已粘贴 ${newEls.length} 个元素`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  历史记录
  // ═══════════════════════════════════════════════════════════
  let hist    = [];   // [{ time, name, state: [innerHTML...] }]
  let histPos = -1;

  function snapshot() {
    return [...document.querySelectorAll('.slide')].map(s => s.innerHTML);
  }

  // 从历史链重建指定位置的完整状态（向前找最近的 base state，再叠加 delta）
  function getFullState(pos) {
    let base = null, baseIdx = -1;
    for (let i = pos; i >= 0; i--) {
      if (hist[i].state) { base = [...hist[i].state]; baseIdx = i; break; }
    }
    if (!base) return snapshot();
    for (let i = baseIdx + 1; i <= pos; i++) {
      if (hist[i].delta) {
        Object.entries(hist[i].delta).forEach(([idx, html]) => { base[+idx] = html; });
      }
    }
    return base;
  }

  // externalChange=true 表示由 AI 写文件触发，不需要再写回磁盘
  function addHistory(name, { externalChange = false } = {}) {
    // 截断当前位置之后的记录（新操作后不能再 redo）
    hist = hist.slice(0, histPos + 1);
    const cur = snapshot();
    let entry, changedIdxs = [];
    if (hist.length === 0) {
      // 第一条：存完整快照作为基准
      entry = { time: new Date(), name, state: cur };
      changedIdxs = cur.map((_, i) => i);
    } else {
      // 后续条：只记录变化的页面
      const prev = getFullState(histPos);
      const delta = {};
      cur.forEach((html, i) => { if (html !== prev[i]) { delta[i] = html; changedIdxs.push(i); } });
      entry = { time: new Date(), name, delta };
    }
    hist.push(entry);
    if (hist.length > 60) hist.shift();
    histPos = hist.length - 1;
    buildHistoryList();
    saveHistory();
    if (!externalChange) {
      // 人类编辑：立即将变动页写回对应 HTML 文件
      changedIdxs.forEach(i => saveSlideToDisk(i));
      markDirty();
    }
  }

  function restoreToPos(pos) {
    if (pos < 0 || pos >= hist.length) return;
    const state = getFullState(pos);
    document.querySelectorAll('.slide').forEach((s, i) => {
      s.innerHTML = state[i] ?? s.innerHTML;
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
    let curBtn = null;
    [...hist].reverse().forEach((h, ri) => {
      const pos = hist.length - 1 - ri;
      const btn = document.createElement('button');
      btn.className = 'hist-item' + (pos === histPos ? ' cur' : '') + (pos > histPos ? ' future' : '');
      btn.innerHTML = `<span class="hist-time">${formatTime(h.time)}</span><span class="hist-name">${h.name}</span>`;
      btn.addEventListener('click', () => restoreToPos(pos));
      el.appendChild(btn);
      if (pos === histPos) curBtn = btn;
    });
    if (curBtn) curBtn.scrollIntoView({ block: 'center', behavior: 'smooth' });
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
    const hz = Math.min(14, Math.max(6, Math.min(nw, nh) * 0.175));
    Object.assign(ov.style, {
      left:      (cx - nw / 2) + 'px',
      top:       (cy - nh / 2) + 'px',
      width:     nw + 'px',
      height:    nh + 'px',
      transform: `rotate(${rot}deg)`,
      '--hz':    hz + 'px',
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
      const pIsContainer = p === slide
        || LAYOUT_CLS.some(s => p.matches(s))
        || p.classList.contains('background');
      if (pIsContainer) {
        if (LAYOUT_CLS.some(s => el.matches(s)) || el.classList.contains('background')) return null;
        return el;
      }
      el = p;
    }
    return null;
  }

  // 遍历 slide，收集所有可选中的叶子元素（与 findSelectable 逻辑一致）
  function getAllSelectableElements(slide) {
    const isContainer = el => LAYOUT_CLS.some(s => el.matches(s)) || el.classList.contains('background');
    const result = [];
    function walk(parent) {
      for (const child of parent.children) {
        if (isContainer(child)) { walk(child); }
        else if (parent === slide || isContainer(parent)) { result.push(child); }
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
    // sel-overlay 的 resize/rotate/reset/edge 手柄自己处理，其余穿透
    const ovHandle = e.target.closest('.sel-resize, .sel-rotate, .sel-reset, .sel-edge');
    if (ovHandle) return;
    if (e.target.closest('#panel') || e.target.closest('#btn-edit')) return;

    const slide = document.querySelector('.slide.active');
    if (!slide) { exitTextEdit(); deselect(); return; }

    // 当 target 不在 slide DOM 内（如 Plotly 把 SVG 交互层挂到 body），
    // 改用坐标判断：若点击位置落在 slide 区域内，找 slide 内实际元素
    let clickTarget = e.target;
    if (!slide.contains(e.target)) {
      const sr = slide.getBoundingClientRect();
      if (e.clientX >= sr.left && e.clientX <= sr.right && e.clientY >= sr.top && e.clientY <= sr.bottom) {
        const els = document.elementsFromPoint(e.clientX, e.clientY);
        clickTarget = els.find(el => slide.contains(el) && el !== slide) || slide;
      } else {
        exitTextEdit(); deselect(); return;
      }
    }

    const target = findSelectable(clickTarget, slide);

    if (!target) {
      // 点击背景 → 退出文字编辑、取消选中、启动框选
      e.preventDefault();
      exitTextEdit();
      deselect();
      marqueeDrag = { startX: e.clientX, startY: e.clientY, slide };
      Object.assign(marqueeEl.style, { left: e.clientX + 'px', top: e.clientY + 'px', width: '0', height: '0', display: 'block' });
      return;
    }

    // Cmd/Ctrl + 单击 → 切换多选
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      exitTextEdit();
      toggleSelect(target);
      return;
    }
    // 如果点击的是当前正在文字编辑的元素，放行让浏览器处理光标
    if (textEditTarget === target) return;
    // 否则阻止默认行为（防止 contentEditable 的文本光标抢占）
    e.preventDefault();
    exitTextEdit();

    // 多选状态下点击已选中的元素 → 保持多选并进入组合移动
    if (selTargets.size > 1 && selTargets.has(target)) {
      const group = [...selTargets].map(el => ({ el, ...getTransform(el) }));
      pendingDrag = { group, primary: target, startX: e.clientX, startY: e.clientY, isDragging: false };
      return;
    }

    // 点击已选中的元素（单选）→ 直接进入移动；否则先单选
    if (!selTargets.has(target)) selectEl(target);
    // 记录所有选中元素的初始 transform，用于组合移动
    const group = [...selTargets].map(el => ({ el, ...getTransform(el) }));
    pendingDrag = { group, primary: target, startX: e.clientX, startY: e.clientY, isDragging: false };
  });

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
      document.body.classList.add('dragging');
      window.getSelection()?.removeAllRanges();
      document.activeElement?.blur();
    }
    if (pendingDrag.isDragging) {
      const ds = getDeckScale();
      // Shift → 轴约束：锁定到位移更大的方向
      let cdx = dx, cdy = dy;
      if (e.shiftKey) {
        if (Math.abs(dx) >= Math.abs(dy)) cdy = 0;
        else cdx = 0;
      }
      pendingDrag.group.forEach(({ el, tx, ty, rot, sx, sy }) => {
        setTransform(el, tx + cdx / ds, ty + cdy / ds, rot, sx, sy);
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
          return r.right > mx1 && r.left < mx2 && r.bottom > my1 && r.top < my2;
        });
        selectMultiple(hits);
      }
      marqueeDrag = null;
    }
    if (pendingDrag) {
      document.body.classList.remove('dragging');
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
  let textEditTarget = null; // 当前正在文字编辑的元素

  function exitTextEdit() {
    if (!textEditTarget) return;
    textEditTarget.contentEditable = 'false';
    textEditTarget.classList.remove('text-editing');
    textEditTarget = null;
  }

  function enterTextEdit(el) {
    if (textEditTarget === el) return;
    exitTextEdit();
    textEditTarget = el;
    el.contentEditable = 'true';
    el.classList.add('text-editing');
    // 把光标放到末尾
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function setPanel(open) {
    document.body.classList.toggle('edit-mode', open);
    document.body.classList.remove('bar-visible'); // 切换模式时重置 footer
    editMode = open;
    // 不再整体设置 contentEditable，由双击单独控制
    if (!open) { exitTextEdit(); deselect(); }
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
  function getCurrentRatioWH() {
    const ar = getComputedStyle(document.documentElement)
      .getPropertyValue('--aspect-ratio').trim() || '16/9';
    const [rw, rh] = ar.split('/');
    return { rw: parseFloat(rw) || 16, rh: parseFloat(rh) || 9 };
  }

  function applyPadding(hRatio, vRatio) {
    const { rw, rh } = getCurrentRatioWH();
    const deckH = BASE_DECK_W * rh / rw;
    document.documentElement.style.setProperty('--h-pad', (hRatio * BASE_DECK_W) + 'px');
    document.documentElement.style.setProperty('--v-pad', (vRatio * deckH) + 'px');
    localStorage.setItem('pres-h-pad-ratio', hRatio);
    localStorage.setItem('pres-v-pad-ratio', vRatio);
    const lh = document.getElementById('label-h-pad');
    const lv = document.getElementById('label-v-pad');
    if (lh) lh.textContent = Math.round(hRatio * 100) + '%';
    if (lv) lv.textContent = Math.round(vRatio * 100) + '%';
  }

  function applyRatio(ratio) {
    const [rw, rh] = ratio.split(':');
    document.documentElement.style.setProperty('--aspect-ratio', `${rw}/${rh}`);
    localStorage.setItem('pres-aspect-ratio', ratio);
    document.querySelectorAll('.ratio-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.ratio === ratio)
    );
    // 比例变化时重新计算 --v-pad（因为 deckH 变了）
    const hRatio = parseFloat(localStorage.getItem('pres-h-pad-ratio') || 0);
    const vRatio = parseFloat(localStorage.getItem('pres-v-pad-ratio') || 0);
    if (hRatio || vRatio) applyPadding(hRatio, vRatio);
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
      const name = path.split('/').pop().replace(/\.html$/, '').replace(/^\d+-/, '').replace(/-/g, ' ');
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

  function buildPaddingSliders() {
    const { rw, rh } = getCurrentRatioWH();
    const deckH   = BASE_DECK_W * rh / rw;
    const defH    = (GLOBAL_CONFIG.hPad || 100) / BASE_DECK_W;
    const defV    = (GLOBAL_CONFIG.vPad || 64)  / deckH;
    const hRatio  = parseFloat(localStorage.getItem('pres-h-pad-ratio') ?? defH);
    const vRatio  = parseFloat(localStorage.getItem('pres-v-pad-ratio') ?? defV);

    const sh = document.getElementById('slider-h-pad');
    const sv = document.getElementById('slider-v-pad');
    if (!sh || !sv) return;

    sh.value = hRatio;
    sv.value = vRatio;
    applyPadding(hRatio, vRatio);

    sh.addEventListener('input', () => applyPadding(parseFloat(sh.value), parseFloat(sv.value)));
    sv.addEventListener('input', () => applyPadding(parseFloat(sh.value), parseFloat(sv.value)));
  }

  // ═══════════════════════════════════════════════════════════
  //  保存 / 重置 / 自动保存  — 写回磁盘文件
  // ═══════════════════════════════════════════════════════════

  // 单页立即写盘，写完后更新 knownMtimes 防止文件监听误报
  async function saveSlideToDisk(idx) {
    if (typeof SLIDES === 'undefined' || !SLIDES[idx]) return;
    const slide = document.querySelectorAll('.slide')[idx];
    if (!slide) return;
    try {
      const res = await fetch('/save', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ path: SLIDES[idx], content: slide.innerHTML }),
      });
      const data = await res.json();
      if (data.ok && data.mtime != null) knownMtimes[SLIDES[idx]] = data.mtime;
    } catch (e) {}
  }

  // 轮询 /mtimes，感知 AI 对 HTML 文件的外部修改
  async function pollForExternalChanges() {
    if (typeof SLIDES === 'undefined' || !SLIDES.length) return;
    try {
      const res = await fetch('/mtimes', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ paths: SLIDES }),
      });
      if (!res.ok) return;
      const mtimes = await res.json();
      const slides = document.querySelectorAll('.slide');

      // 先收集本轮所有变化的页面，再统一更新和记录历史
      const changed = []; // [{ idx, path, mtime }]
      for (const [path, mtime] of Object.entries(mtimes)) {
        const known = knownMtimes[path];
        if (known == null) { knownMtimes[path] = mtime; continue; }
        if (mtime > known + 0.1) {
          const idx = SLIDES.indexOf(path);
          if (idx < 0) { knownMtimes[path] = mtime; continue; }
          changed.push({ idx, path, mtime });
        }
      }
      if (!changed.length) return;

      // 并行 fetch 所有变化页面的新内容
      const fetched = await Promise.all(
        changed.map(({ path }) =>
          fetch(path + '?_=' + Date.now()).then(r => r.text()).catch(() => null)
        )
      );

      // 应用更新
      changed.forEach(({ idx, path, mtime }, i) => {
        if (fetched[i] == null) return;
        slides[idx].innerHTML = fetched[i];
        knownMtimes[path] = mtime;
      });

      // 合并成一条历史记录，截断未来版本
      const pageNums = changed.map(({ idx }) => `第${idx + 1}页`).join('、');
      addHistory(`文件更改 ${pageNums}`, { externalChange: true });
      toast(`AI 更新了 ${pageNums} ↻`);
      window.onSlideChange?.();
    } catch (e) {}
  }

  function startFileWatcher() {
    if (typeof SLIDES === 'undefined' || !SLIDES.length) return;
    // 先拿一次初始 mtime 基准，再开始轮询
    fetch('/mtimes', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ paths: SLIDES }),
    })
      .then(r => r.json())
      .then(data => { Object.assign(knownMtimes, data); })
      .catch(() => {})
      .finally(() => { setInterval(pollForExternalChanges, 2500); });
  }

  // 把历史记录序列化后写到 slides.history.json
  function saveHistory() {
    const historyPath = (typeof SLIDES !== 'undefined' && SLIDES.length)
      ? SLIDES[0].replace(/\/[^/]+$/, '/slides.history.json')
      : 'slides.history.json';
    const payload = {
      pos:     histPos,
      entries: hist.map(h => ({
        time:  h.time instanceof Date ? h.time.toISOString() : h.time,
        name:  h.name,
        ...(h.state ? { state: h.state } : { delta: h.delta ?? {} }),
      })),
    };
    fetch('/save', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ path: historyPath, content: JSON.stringify(payload, null, 2) }),
    }).catch(() => {}); // 历史写失败不影响主流程
  }

  async function saveAll() {
    const slides = document.querySelectorAll('.slide');
    const files  = [];
    slides.forEach((s, i) => {
      if (SLIDES[i]) files.push({ path: SLIDES[i], content: s.innerHTML });
    });
    try {
      const res  = await fetch('/save-batch', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(files),
      });
      const data = await res.json();
      if (data.ok) {
        markClean();
        saveHistory();
        if (data.mtimes) Object.assign(knownMtimes, data.mtimes);
        toast('已保存到文件 ✓');
      } else {
        toast('保存失败: ' + data.error);
      }
    } catch (e) {
      // 服务器不可用时降级到 localStorage
      slides.forEach((s, i) => localStorage.setItem(`pres-slide-${i}`, s.innerHTML));
      markClean();
      toast('已保存（本地）✓');
    }
  }

  function resetCurrent() {
    // 从原始文件重新加载（不走 localStorage）
    fetch(SLIDES[cur] + '?_=' + Date.now())
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

  // 启动时不再从 localStorage 恢复（文件本身就是最新状态）
  function loadSaved() {
    // no-op：内容已由 init() 直接从文件加载
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
  // 从磁盘加载历史记录（slides.history.json）
  async function loadHistory() {
    if (typeof SLIDES === 'undefined' || !SLIDES.length) return;
    const historyPath = SLIDES[0].replace(/\/[^/]+$/, '/slides.history.json');
    try {
      const res = await fetch(historyPath + '?_=' + Date.now());
      if (!res.ok) return;
      const raw = await res.json();
      // 兼容旧格式（数组）和新格式（{pos, entries}）
      const entries = Array.isArray(raw) ? raw : (raw.entries ?? []);
      hist    = entries.map(h => ({ ...h, time: new Date(h.time) }));
      histPos = Array.isArray(raw) ? hist.length - 1 : (raw.pos ?? hist.length - 1);
      buildHistoryList();
    } catch (e) {
      // 文件不存在或解析失败，忽略
    }
  }

  window.addEventListener('pres-ready', async () => {
    buildThemes();
    buildTrans();
    buildRatioBtns();
    buildPaddingSliders();
    buildSlideList();
    loadSaved();
    applyTheme(localStorage.getItem('pres-theme') || 'dawn');
    document.body.dataset.transition = localStorage.getItem('pres-transition') || 'slide';
    updateDeckScale();
    setPanel(true);
    // 先尝试从磁盘恢复历史，没有再记录初始状态
    await loadHistory();
    if (hist.length === 0) addHistory('初始状态');
    startFileWatcher();
  });

  window.onSlideChange = () => { buildSlideList(); deselect(); if (dirty) saveAll(); };

  window.addEventListener('blur', () => { if (dirty) saveAll(); });

  // ═══════════════════════════════════════════════════════════
  //  演示模式 footer：鼠标停留在底部区域 2 秒后浮现
  // ═══════════════════════════════════════════════════════════
  (function initBarHover() {
    const ZONE  = 40;  // 距底部多少 px 算"底部区域"
    const DELAY = 2000;
    let timer = null;

    function showBar()  { document.body.classList.add('bar-visible'); }
    function hideBar()  { document.body.classList.remove('bar-visible'); }

    document.addEventListener('mousemove', e => {
      if (editMode) { hideBar(); return; }
      const nearBottom = (window.innerHeight - e.clientY) <= ZONE;
      if (nearBottom) {
        if (!timer) timer = setTimeout(showBar, DELAY);
      } else {
        clearTimeout(timer); timer = null;
        hideBar();
      }
    });

    // 鼠标移出窗口时也隐藏
    document.addEventListener('mouseleave', () => {
      clearTimeout(timer); timer = null;
      hideBar();
    });
  })();

  // ═══════════════════════════════════════════════════════════
  //  事件绑定
  // ═══════════════════════════════════════════════════════════
  document.getElementById('btn-present').addEventListener('click', enterPresentation);
  document.getElementById('btn-edit').addEventListener('click',    () => setPanel(true));
  document.getElementById('btn-save').addEventListener('click',    saveAll);
  document.getElementById('btn-reset').addEventListener('click',   resetCurrent);

  // 捕获阶段拦截方向键：元素选中时微调位置，阻止幻灯片翻页
  document.addEventListener('keydown', e => {
    if (!editMode || !selTargets.size || textEditTarget) return;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const step = e.shiftKey ? 10 : 1;
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
    const dy = e.key === 'ArrowUp'   ? -step : e.key === 'ArrowDown'  ? step : 0;
    selTargets.forEach(el => {
      const { tx, ty, rot, sx, sy } = getTransform(el);
      setTransform(el, tx + dx, ty + dy, rot, sx, sy);
    });
    if (selTarget) positionOv();
    clearTimeout(nudgeTimer);
    nudgeTimer = setTimeout(() => addHistory(`移动 第${cur+1}页`), 600);
  }, true);

  document.addEventListener('keydown', e => {
    // Ctrl/Cmd + Z → undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); toast('撤销 ↩'); return; }
    // Ctrl/Cmd + Shift + Z  or Ctrl+Y → redo
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); toast('重做 ↪'); return; }
    // Ctrl/Cmd + S → save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveAll(); return; }
    // Ctrl/Cmd + C → copy selected
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && editMode && selTargets.size) { e.preventDefault(); copySelected(); return; }
    // Ctrl/Cmd + V → paste
    if ((e.ctrlKey || e.metaKey) && e.key === 'v' && editMode) { e.preventDefault(); pasteClipboard(); return; }
    if (e.target.isContentEditable) return;
    // Ctrl/Cmd + A → 全选当前页所有元素
    if ((e.ctrlKey || e.metaKey) && e.key === 'a' && editMode) {
      e.preventDefault();
      const slide = document.querySelector('.slide.active');
      if (slide) { const all = getAllSelectableElements(slide); if (all.length) selectMultiple(all); }
      return;
    }
    // Esc → 退出编辑模式
    if (e.key === 'Escape' && editMode) { setPanel(false); return; }
    // E → 切换编辑面板
    if ((e.key === 'e' || e.key === 'E') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      setPanel(!editMode);
      return;
    }
  });

  // 双击 → 进入文字编辑模式
  document.addEventListener('dblclick', e => {
    if (!editMode) return;
    const slide = document.querySelector('.slide.active');
    if (!slide || !slide.contains(e.target)) return;
    const target = findSelectable(e.target, slide);
    if (!target) return;
    enterTextEdit(target);
  });

  // 文字编辑：防抖后记录历史
  document.addEventListener('input', e => {
    if (!editMode || !textEditTarget || e.target !== textEditTarget) return;
    clearTimeout(textEditTimer);
    textEditTimer = setTimeout(() => addHistory(`编辑 第${cur+1}页 文本`), 1500);
    triggerAutoSave();
  });
})();
