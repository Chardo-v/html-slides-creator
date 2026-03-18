---
name: html-slides-creator
description: >
  用于在 html-slides-creator 框架中创建和修改 HTML 幻灯片演示。只要用户提到
  "幻灯片"、"slide"、"PPT"、"演示"、"做一套介绍"、"加一页"、"启动预览"，就应使用本 skill。
---

# html-slides-creator

使用本 skill 前，先按以下规则确定 `skill_root`：

- **普通模式**：`skill_root` = `SKILL.md` 所在目录（默认）。
- **开发者模式**：`skill_root` = 当前工作目录下的 `html-slides-creator/` 子目录。

**何时进入开发者模式**（满足任一即建议/进入）：
- 用户明确提到"开发者模式"或"developer mode"
- 用户提到 slides 框架本身有 bug（网页显示异常、服务器报错等）
- 当前工作目录已存在 `html-slides-creator/` 且其中有 `scripts/server.py`

**进入开发者模式的步骤**：将 skill 完整复制到当前工作目录：

```bash
# Claude 环境用：
cp -r ~/.claude/skills/html-slides-creator .
# Codex 环境则用：
cp -r ~/.codex/skills/html-slides-creator .
```

之后所有修改都在当前目录的 `html-slides-creator/` 中进行，不影响已安装的 skill。

目录结构固定如下：

```text
skill_root/
├── SKILL.md
├── scripts/
│   ├── server.py            # 开发服务器
│   └── run_slides.py        # 启动脚本模板（需复制到用户 slides 目录）
└── assets/
    ├── runtime/             # 框架运行时（勿修改）
    └── example-slides/      # 布局参考示例
```

> 自动刷新：保存 HTML 后浏览器在 2.5s 内自动刷新对应页面。

## 标准工作流

在用户项目里创建一个独立 slides 文件夹，结构如下：

```text
my-topic-slides/
├── run_slides.py          # 从 scripts/run_slides.py 复制而来（见下方说明）
├── slides.js              # 幻灯片列表
├── slides.history.json    # 该文件由框架自动维护。**禁止**读取或修改该文件。
├── 01-cover.html
├── 02-agenda.html
└── ...
```

**启动脚本**：把 `scripts/run_slides.py` 复制到 slides 文件夹，并把其中
`SKILL_ROOT` 的值替换为本 skill 的实际绝对路径（即 `SKILL.md` 所在目录），例如：

```python
SKILL_ROOT = Path("/Users/alice/.claude/skills/html-slides-creator")
```

用户直接在 slides 文件夹里执行这个 `.py` 文件即可启动预览，无需手动切换目录。

**`slides.js` 格式**（`GLOBAL_CONFIG` 和 `SLIDES` 两个对象缺一不可，运行时均依赖它们）：

```js
const GLOBAL_CONFIG = {
  title:        '演示文稿标题',   // 浏览器标题
  aspectRatio:  '16:9',           // '16:9' | '4:3' | '1:1' | '21:9'
  vPad:         64,               // 纵向边距（px）
  hPad:         100,              // 横向边距（px）
  baseFontSize: 16,               // 基础字号（px）
};

const SLIDES = [
  '01-cover.html',
  '02-agenda.html',
];
```

先浏览 `assets/example-slides/` 选择合适布局，再开始编写 HTML。

## Slide HTML 约束

每张 slide 是一个 HTML 片段，被框架以 `innerHTML` 插入，因此：

- **禁止** `<html>`、`<head>`、`<body>`、`<script>`、`<style>` 标签
- **最外层必须是单个 `<div>`**，带布局类
- **颜色全部用 CSS 变量**，禁止硬编码色值

引用 slides 目录内的图片等资源用 `/slides/...` 路径：

```html
<img src="/slides/assets/cover.png" alt="">
```

## 布局参考

示例文件均在 `assets/example-slides/`。

| 布局类 | 适合场景 | 示例文件 |
|--------|---------|---------|
| `.layout-cover` | 封面页 | `01-cover.html` |
| `.slide-content` | 通用内容页（最常用） | `02-agenda.html`、`04-bullets.html` |
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
| `.grid.grid-3` / `.grid-2` + `.card` | 并列功能/特性卡片；卡片内部固定用 `.card-icon`（emoji）、`.card-title`、`.card-desc` 三个子类，**禁止**在卡片内用内联 `font-size`/`font-weight` 等排版属性覆盖 |
| `.steps` + `.step` | 有序步骤流程 |
| `.compare` + `.compare-box` | 左右对比，右侧可加 `.highlight`；**禁止**在 `.compare-box` 内使用 `.item-list`（CSS 优先级冲突会破坏 › 对齐）；若需要带列表的左右对比，改用 `.grid.grid-2` + `.card` + `.item-list` |
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

需要图表时，查阅 `assets/example-slides/06-chart.html`——文件顶部有完整的用法注释，包括数据属性写法、多系列 bar、完整 JSON 配置，以及双图布局示例。

## 质量检查

- [ ] 最外层是单个 `<div>` 带布局类，无 `<html>/<head>/<body>/<script>/<style>`
- [ ] 颜色全部使用 CSS 变量；**禁止**内联 `font-size`、`font-weight`、`color` 等排版属性（框架语义类已处理，内联覆盖会导致字体偏小或样式冲突）
- [ ] 每页不超过 5 个要点或 3 个卡片
- [ ] `slides.js` 同时包含 `GLOBAL_CONFIG` 和 `SLIDES` 两个对象（缺 `GLOBAL_CONFIG` 会报 ReferenceError）
- [ ] 文件名已加入 `slides.js` 的 `SLIDES` 数组
- [ ] slides 文件夹内有 `run_slides.py`（`SKILL_ROOT` 已改为实际绝对路径）
