---
name: html-slides-creator
description: >
  用于在 html-slides-creator 框架中创建、修改和运行 HTML 幻灯片。当用户说
  "帮我做一页 PPT / 幻灯片"、"加一张关于 X 的页面"、"新建介绍 Y 的 slide"、
  "给演示文稿添加内容"、"修改某一页"、"帮我做一套演示"或"启动 slides 预览"
  时，必须使用本 skill。只要用户在此项目里提到"幻灯片"、"slide"、"PPT"、
  "演示页"，就应激活本 skill。
---

# html-slides-creator

使用本 skill 时，先定位当前 `SKILL.md` 所在目录，记为 `skill_root`。不要假设当前环境是 Codex 还是 Claude Code，也不要硬编码 `~/.codex/skills` 或 `~/.claude/skills`；一律相对 `SKILL.md` 自己定位。

## 目录约定

本仓库本身就是 skill，目录固定如下：

```text
skill_root/
├── SKILL.md
├── scripts/
│   └── server.py
└── assets/
    ├── runtime/
    └── examples/
```

含义如下：

- `scripts/server.py`：运行时开发服务器，负责提供框架页面并挂载某个 slides 文件夹。
- `assets/runtime/`：框架运行时代码，不要把用户自己的演示内容写进这里。
- `assets/examples/example-slides/`：内置示例，仅作参考。

## 开始前必须确认

1. 运行时框架位于 `skill_root/assets/runtime/`。
2. 启动服务脚本位于 `skill_root/scripts/server.py`。
3. 当前演示内容必须放在用户自己的 slides 文件夹中，不要写进 skill 仓库。
4. 必须在这个 slides 文件夹内生成一个 `.py` 启动脚本，由它调用 `skill_root/scripts/server.py <当前 slides 文件夹路径>`。

> 自动刷新：保存 HTML 文件后，浏览器会在 2.5s 内自动检测变化并刷新对应页面。

## 标准工作流

1. 先看 `skill_root/assets/examples/example-slides/`，按现有示例选择布局。
2. 在用户项目里创建一个独立的 slides 文件夹，例如：

```text
some-project/my-topic-slides/
```

3. 在这个 slides 文件夹里生成以下文件：

- `slides.js`
- `NN-name.html` 若干
- `slides.history.json`（可由编辑器自动生成）
- 一个启动用 `.py` 文件，例如 `run_slides.py`

4. 这个启动用 `.py` 文件必须调用：

```text
skill_root/scripts/server.py
```

并把“当前 slides 文件夹路径”作为参数传给它。

## 启动脚本要求

每次新建演示时，都要在该演示目录内生成一个 `.py` 启动脚本。这个脚本的职责只有两件事：

1. 定位当前文件所在目录，把它当作 slides 根目录。
2. 调用 `skill_root/scripts/server.py <当前目录>`。

不要要求用户手动切到 skill 仓库再敲命令；默认直接运行演示目录里的这个 `.py` 文件即可启动预览。可参考 `skill_root/assets/examples/example-slides/run_slides.py`。

## slides 文件夹约定

一个演示目录通常长这样：

```text
my-topic-slides/
├── run_slides.py
├── slides.js
├── slides.history.json
├── 01-cover.html
├── 02-agenda.html
└── ...
```

`slides.js` 里的 `SLIDES` 建议写文件名本身，例如：

```js
const SLIDES = [
  '01-cover.html',
  '02-agenda.html',
];
```

不要写死 `example-slides/...`。运行时会自动把这些路径解释为当前 slides 文件夹中的文件。

## 关键约束

- **不能含** `<html>` `<head>` `<body>` `<script>` `<style>` 标签，内容直接被 `innerHTML` 插入。
- **最外层必须是单个 `<div>`**，带布局类。
- **颜色全部用 CSS 变量**（`var(--accent)` 等），禁止硬编码色值。

## 布局参考

| 布局类 | 最适合 | 参考文件 |
|--------|--------|---------|
| `.layout-cover` | 封面页 | `skill_root/assets/examples/example-slides/01-cover.html` |
| `.slide-content` | 通用内容页（最常用） | `skill_root/assets/examples/example-slides/02-agenda.html`, `skill_root/assets/examples/example-slides/04-bullets.html` |
| `.layout-section` | 节标题过渡页（反色大字） | `skill_root/assets/examples/example-slides/03-section.html` |
| `.layout-image-right` | 图文说明（图在右） | `skill_root/assets/examples/example-slides/05-image-text.html` |
| `.layout-image-left` | 图文说明（图在左） | — |
| `.layout-quote` | 金句 / 强调页 | `skill_root/assets/examples/example-slides/09-quote.html` |
| `.layout-closing` | 结束 / Q&A 页 | `skill_root/assets/examples/example-slides/10-closing.html` |
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
| `.data-table` | 对比表格（`.td-yes` / `.td-no` / `.td-partial`） |
| `.terminal` | 命令行终端模拟 |
| `.code-block` | 代码块 |
| `.img-frame` | 图片容器（4:3，自动裁剪） |
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

### 方式一：数据属性

```html
<div data-plotly="bar" data-values="40,65,80" data-labels="Q1,Q2,Q3" style="flex:1;min-height:0"></div>
<div data-plotly="pie" data-values="35,28,20" data-labels="华东,华南,华北" style="flex:1;min-height:0"></div>
<div data-plotly="bar" data-labels="Q1,Q2,Q3"
     data-series='[{"name":"2024","values":"40,55,70"},{"name":"2025","values":"52,68,88"}]'
     style="flex:1;min-height:0"></div>
```

可选属性：`data-title`、`data-y-title`。

### 方式二：完整 JSON 配置

```html
<div style="flex:1;min-width:0"
     data-plotly-config='{"data":[{"type":"violin","y":[32,38,41,35,43,31,39,36],"name":"A","box":{"visible":true},"meanline":{"visible":true}}],"layout":{"showlegend":false}}'></div>

<div style="flex:1;min-width:0"
     data-plotly-config='{"data":[{"type":"barpolar","r":[38,28,22,12],"theta":["华东","华南","华北","华西"],"marker":{"color":[38,28,22,12],"colorscale":"Plasma"}}],"layout":{"polar":{"radialaxis":{"visible":false}},"showlegend":false}}'></div>

<div style="flex:1;min-width:0"
     data-plotly-config='{"data":[{"type":"sunburst","labels":["总","A","B","A1","A2"],"parents":["","总","总","A","A"],"values":[100,60,40,35,25],"branchvalues":"total"}]}'></div>
```

左右双图布局：用 `display:flex;gap:32px` 的容器包两个 `flex:1` 的图表 div。参考 `skill_root/assets/examples/example-slides/06-chart.html`。

## 本地资源路径

如果 slide 里要引用当前演示目录中的图片或其他资源，使用 `/slides/...` 路径，例如：

```html
<img src="/slides/assets/cover.png" alt="封面图">
```

不要写 `example-slides/...`，也不要假设运行页与 HTML 文件在同一目录。

## 工作边界

- 用户自己的 slide HTML、图片、数据文件、`slides.js`、`slides.history.json` 都应放在用户的 slides 文件夹中，不要写入 `assets/runtime/`。
- 运行时框架代码优先从 `skill_root/assets/runtime/` 读取。
- 如果需要参考现成版式，查看 `skill_root/assets/examples/example-slides/`。
- 不要创建 `README.md` 或额外文档文件。

如果用户请求的是“基于现有脚本生成演示”或“修改某一页”，先通读本 `SKILL.md`，再开始实际编辑。

## 质量检查

- [ ] 最外层是单个 `<div>` 带布局类，无 `<html>/<head>/<body>/<script>/<style>`
- [ ] 颜色全部使用 CSS 变量
- [ ] 每页不超过 5 个要点或 3 个卡片
- [ ] 文件名已加入当前 slides 文件夹中的 `slides.js` 的 `SLIDES` 数组
- [ ] 当前 slides 文件夹内已生成一个调用 `skill_root/scripts/server.py` 的启动 `.py` 文件
