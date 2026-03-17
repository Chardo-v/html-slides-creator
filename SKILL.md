---
name: html-slides-creator
description: >
  用于在 AIPresent 框架中创建和添加幻灯片页面。当用户说"帮我做一页
  PPT / 幻灯片"、"加一张关于 X 的页面"、"新建介绍 Y 的 slide"、
  "给演示文稿添加内容"、"修改某一页"或"帮我做一套演示"时，必须使用
  本 skill。只要用户在此项目里提到"幻灯片"、"slide"、"PPT"、"演示页"，
  就应激活本 skill。
---

# AIPresent 幻灯片创建指南

## 项目结构

```
slides.js          — 全局配置（标题、比例、边距）和幻灯片列表
themes.js          — 5 个主题定义（dawn / dusk / aurora / field / ink）
theme.css          — 所有布局类、组件类、CSS 变量
slides/NN-name/
  slide.html       — 单页幻灯片内容（无 html/head/body 标签）
```

## 工作流

1. **理解内容** — 弄清要展示的信息类型和目的。
2. **选布局** — 按下方布局参考选最合适的结构。
3. **创建文件** — 在 `slides/` 下新建 `NN-name/slide.html`，目录名用两位序号前缀。
4. **注册** — 把路径加入 `slides.js` 的 `SLIDES` 数组。
5. **验证** — 最外层是单个 `<div>`，类名拼写正确，颜色用 CSS 变量。

## 关键约束

- `slide.html` **不能含** `<html>` `<head>` `<body>` 标签——内容直接被 `innerHTML` 插入。
- **最外层必须是单个 `<div>`**，带布局类。
- **颜色全部用 CSS 变量**（`var(--accent)` 等），禁止硬编码色值，否则主题切换会出错。
- 参考 `slides/` 下已有页面的真实 HTML 作为写法依据。

## 布局参考

| 布局类 | 最适合 |
|--------|--------|
| `.layout-hero` | 封面、章节大标题 |
| `.slide-center` | 简洁声明、过渡页 |
| `.slide-content` | 通用内容页（最常用） |
| `.slide-content.two-col` | 两列对比、文字 + 代码/图 |
| `.layout-quote` | 引言、金句 |
| `.layout-image-right` | 图文说明（图在右） |
| `.layout-image-left` | 图文说明（图在左） |
| `.layout-stats` | 关键数字统计 |
| `.layout-timeline` | 历史、流程时间线 |
| `.layout-dashboard` | 图表 + 统计仪表盘 |

## 组件参考

| 组件 | 用途 |
|------|------|
| `.tag` | 章节标签，放在 h2 前 |
| `.grid.grid-3` / `.grid-2` + `.card` | 并列功能/特性卡片 |
| `.steps` + `.step` | 有序步骤流程（3-4步） |
| `.item-list` | 要点列表（自动加 › 前缀） |
| `.compare` + `.compare-box` | 左右两列对比，右侧可加 `.highlight` |
| `.stat-card` | 突出大数字 + 标签 |
| `.layout-stats` + `.stats-row` | 3列统计卡片行 |
| `.timeline` + `.tl-item` | 带竖线的时间线条目 |
| `.data-table` | 功能对比表格（支持 `.td-yes/.td-no/.td-partial`）|
| `.terminal` | 命令行终端模拟 |
| `.code-block` | 带语法高亮的代码块 |
| `.img-frame` | 图片/SVG 容器（4:3 比例，自动裁剪）|

## CSS 变量速查

| 变量 | 用途 |
|------|------|
| `var(--accent)` | 主色：按钮、图标、强调文字 |
| `var(--accent-dim)` | 主色淡化：背景标注 |
| `var(--text)` | 正文颜色 |
| `var(--muted)` | 次要文字、描述 |
| `var(--surface)` | 卡片/面板背景（毛玻璃） |
| `var(--border)` | 边框 |
| `var(--v-pad)` / `var(--h-pad)` | 纵向/横向边距 |

## 文字层级

| 标签/类 | 尺寸 | 用途 |
|---------|------|------|
| `.hero-title` | 5.5rem | 封面超大标题 |
| `h1` | 3.2rem | 章节大标题 |
| `h2` | 2rem | 内容标题（自带下边距） |
| `h3` | 1.2rem | 卡片/步骤子标题（--muted 色）|
| `p` | 1.15rem | 正文（--muted 色，行高 1.75）|
| `.quote-text` | 2.2rem | 引言（font-weight:300） |

## 注册新幻灯片

在 `slides.js` 的 `SLIDES` 数组适当位置添加路径：

```js
'slides/NN-name/slide.html',
```

## 质量检查清单

- [ ] 最外层是单个 `<div>` 带布局类
- [ ] 无 `<html>` / `<head>` / `<body>` 标签
- [ ] 颜色全部使用 CSS 变量
- [ ] 文字层级合理（h2 主标题，h3 子标题，p 正文）
- [ ] 内容量适中：每页不超过 6 个要点或 3 个卡片
- [ ] 路径已加入 `slides.js`
