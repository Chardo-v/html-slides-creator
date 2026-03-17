# AIPresent — 人机协作幻灯片模板

轻量 HTML 演示框架，专为 AI 生成 + 人工微调的工作流设计。无需安装任何依赖，浏览器打开即用。

## 快速开始

```bash
cd AIPresent
python3 -m http.server 3333
# 浏览器打开 http://localhost:3333
```

## 功能

- **演示模式** — 空格/方向键翻页，全屏展示
- **编辑模式** — 右侧面板切换主题、动画、页面比例；直接拖拽/缩放元素；inline 编辑文字
- **撤销/重做** — Ctrl+Z / Ctrl+Shift+Z，历史记录面板可点击跳转
- **自动保存** — 编辑内容存入 localStorage，刷新不丢失
- **5 套主题** — 晨曦 / 暮光 / 极光 / 原野 / 墨韵，一键切换

## 项目结构

```
├── index.html        # 入口
├── slides.js         # 幻灯片顺序 & 全局配置（比例、边距、字号）
├── themes.js         # 主题定义
├── theme.css         # 全局样式 & 布局类
├── transitions.css   # 过渡动画（推入/淡化/缩放）
├── editor.css/js     # 编辑器
└── slides/
    ├── 01-title/slide.html
    ├── 02-xxx/slide.html
    └── ...
```

## 添加新幻灯片

1. 创建文件夹 `slides/08-your-topic/slide.html`
2. 在 `slides.js` 的 `SLIDES` 数组中添加路径
3. 使用 `theme.css` 中的布局类编写内容：

| 布局类 | 用途 |
|--------|------|
| `.layout-hero` | 全屏大标题 |
| `.slide-content` | 通用内容页 |
| `.two-col` | 左右双栏 |
| `.layout-quote` | 引言页 |
| `.layout-image-right/left` | 图文混排 |
| `.layout-stats` | 数据统计 |
| `.layout-timeline` | 时间线 |

## AI 生成指引

AI 生成 slide 时应参照 `slides.js` 中的 `GLOBAL_CONFIG`（页面比例、边距等），使用 `theme.css` 提供的 CSS 变量（`--accent`、`--text`、`--surface` 等）和布局类，只输出纯 HTML 片段，不包含 `<style>` 或 `<script>`。

## 快捷键

| 按键 | 功能 |
|------|------|
| `→` `↓` `空格` | 下一页 |
| `←` `↑` | 上一页 |
| `Ctrl+S` | 保存 |
| `Ctrl+Z` | 撤销 |
| `Ctrl+Shift+Z` | 重做 |
| `Esc` | 退出编辑模式 |
