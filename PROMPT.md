# html-slides-creator 幻灯片创建指南

## 工作流

1. **选布局** — 按下方表格选合适的布局类，参考 `example-slides/` 下对应文件的真实写法。
2. **创建文件** — 在 `slides/` 下新建 `NN-name.html`（两位序号前缀）。
3. **注册** — 把路径加入 `example-slides/slides.js` 的 `SLIDES` 数组。

> **自动刷新**：保存 HTML 文件后，浏览器在 2.5s 内自动检测变化并刷新对应页面。

## 关键约束

- **不能含** `<html>` `<head>` `<body>` `<script>` `<style>` 标签——内容直接被 `innerHTML` 插入。
- **最外层必须是单个 `<div>`**，带布局类。
- **颜色全部用 CSS 变量**（`var(--accent)` 等），禁止硬编码色值。

## 布局参考

| 布局类 | 最适合 | 参考文件 |
|--------|--------|---------|
| `.layout-cover` | 封面页 | `01-cover.html` |
| `.slide-content` | 通用内容页（最常用） | `02-agenda.html`, `04-bullets.html` |
| `.layout-section` | 节标题过渡页（反色大字） | `03-section.html` |
| `.layout-image-right` | 图文说明（图在右） | `05-image-text.html` |
| `.layout-image-left` | 图文说明（图在左） | — |
| `.layout-quote` | 金句 / 强调页 | `09-quote.html` |
| `.layout-closing` | 结束 / Q&A 页 | `10-closing.html` |
| `.slide-content.two-col` | 两列对比 | — |
| `.layout-stats` | 关键数字统计 | — |
| `.layout-timeline` | 时间线 / 流程 | — |
| `.layout-dashboard` | 图表仪表盘 | — |

## 通用组件

| 组件 | 用途 |
|------|------|
| `.tag` | 章节分类标签，放在 `.slide-content` 顶部 |
| `.item-list` + `<li>` | 要点列表（自动加 › 前缀） |
| `.grid.grid-3` / `.grid-2` + `.card` | 并列功能/特性卡片 |
| `.steps` + `.step` | 有序步骤流程 |
| `.compare` + `.compare-box` | 左右对比，右侧可加 `.highlight` |
| `.stat-card` / `.stat-big` | 突出大数字 |
| `.timeline` + `.tl-item` | 带竖线的时间线 |
| `.agenda-list` + `.agenda-item` | 目录列表，`.active` 高亮当前项 |
| `.data-table` | 对比表格（`.td-yes` / `.td-no` / `.td-partial`）|
| `.terminal` | 命令行终端模拟 |
| `.code-block` | 代码块 |
| `.img-frame` | 图片容器（4:3，自动裁剪）|
| `.chart-insight` | 图表下方结论句 |

## CSS 变量速查

| 变量 | 用途 |
|------|------|
| `var(--accent)` | 主色：标题、图标、强调 |
| `var(--accent-dim)` | 主色淡化：背景标注 |
| `var(--text)` | 正文颜色 |
| `var(--muted)` | 次要文字 |
| `var(--surface)` | 卡片背景（毛玻璃） |
| `var(--border)` | 边框 |
| `var(--v-pad)` / `var(--h-pad)` | 纵向/横向边距 |

## Plotly 图表

通过数据属性自动初始化，无需写 `<script>`。背景、字体、颜色由 `baseLayout()` 自动注入，`layout` 里只写需要覆盖的字段。

### 方式一：数据属性（简单图型）

```html
<!-- 单系列：bar / line / area / pie / scatter -->
<div data-plotly="bar" data-values="40,65,80" data-labels="Q1,Q2,Q3" style="flex:1;min-height:0"></div>
<div data-plotly="pie" data-values="35,28,20" data-labels="华东,华南,华北" style="flex:1;min-height:0"></div>

<!-- 多系列 -->
<div data-plotly="bar" data-labels="Q1,Q2,Q3"
     data-series='[{"name":"2024","values":"40,55,70"},{"name":"2025","values":"52,68,88"}]'
     style="flex:1;min-height:0"></div>
```

可选属性：`data-title`、`data-y-title`。

### 方式二：完整 JSON 配置（任意图型）

```html
<!-- 小提琴图 -->
<div style="flex:1;min-width:0"
     data-plotly-config='{"data":[{"type":"violin","y":[32,38,41,35,43,31,39,36],"name":"A","box":{"visible":true},"meanline":{"visible":true}}],"layout":{"showlegend":false}}'></div>

<!-- 极坐标柱图（barpolar）-->
<div style="flex:1;min-width:0"
     data-plotly-config='{"data":[{"type":"barpolar","r":[38,28,22,12],"theta":["华东","华南","华北","华西"],"marker":{"color":[38,28,22,12],"colorscale":"Plasma"}}],"layout":{"polar":{"radialaxis":{"visible":false}},"showlegend":false}}'></div>

<!-- 旭日图（sunburst）-->
<div style="flex:1;min-width:0"
     data-plotly-config='{"data":[{"type":"sunburst","labels":["总","A","B","A1","A2"],"parents":["","总","总","A","A"],"values":[100,60,40,35,25],"branchvalues":"total"}]}'></div>
```

左右双图布局：用 `display:flex;gap:32px` 的容器包两个 `flex:1` 的图表 div。参考 `example-slides/06-chart.html`。

## 质量检查

- [ ] 最外层是单个 `<div>` 带布局类，无 `<html>/<head>/<body>/<script>/<style>`
- [ ] 颜色全部使用 CSS 变量
- [ ] 每页不超过 5 个要点或 3 个卡片
- [ ] 路径已加入 `example-slides/slides.js` 的 `SLIDES` 数组
