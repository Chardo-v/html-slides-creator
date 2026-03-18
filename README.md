# html-slides-creator — 人机协作幻灯片框架

轻量 HTML 演示框架，专为 **AI 生成 + 人工微调** 的协作工作流设计。无需安装任何依赖，浏览器打开即用。

## 快速开始

```bash
python3 server.py        # 默认 3333 端口
python3 server.py 8080   # 指定端口
# 浏览器打开 http://localhost:3333
```

## 核心功能

- **演示模式** — 空格/方向键翻页，全屏展示，多套过渡动画
- **编辑模式** — 拖拽/缩放/旋转元素，inline 编辑文字，框选多元素操作
- **撤销/重做** — Ctrl+Z / Ctrl+Shift+Z，历史面板可点击跳转任意时间点
- **5 套主题** — 晨曦 / 暮光 / 极光 / 原野 / 墨韵，一键切换
- **Plotly 图表** — 数据属性驱动（bar/line/area/pie/scatter），或 `data-plotly-config` 传完整 JSON 支持 violin/barpolar/sunburst 等任意图型

### 人机实时协作

- **人类编辑 → 立即写盘**：在网页上对任意页面的修改，完成后立即写回对应 HTML 文件，AI 可直接读到最新内容
- **AI 修改 → 浏览器自动感知**：server 每 2.5s 轮询各 slide 文件的 mtime，检测到外部（AI）改动后自动重新加载该页内容，并在历史记录中追加一条"AI修改 第N页"
- **历史记录持久化**：增量 delta 格式存入 `slides.history.json`，每条只记录变化的页面，协作双方的每次操作均有据可查

## 项目结构

```
├── index.html                    # 入口
├── server.py                     # 开发服务器（无缓存 + 文件写入 + mtime 查询）
├── utils/
│   ├── theme.css                 # 全局样式、布局类、CSS 变量
│   ├── themes.js                 # 5 套主题定义
│   ├── editor.js                 # 编辑器（拖拽、历史、文件监听）
│   ├── plotly-charts.js          # Plotly 图表自动初始化
│   └── transitions.css           # 过渡动画
└── example-slides/
    ├── slides.js                 # 幻灯片顺序 & 全局配置
    ├── slides.history.json       # 历史记录（增量 delta 格式）
    ├── 01-cover.html             # 封面页示例
    ├── 02-agenda.html            # 目录页示例
    └── ...                       # 更多示例模板
```

## 添加新幻灯片

1. 创建文件 `example-slides/NN-your-topic.html`（只写纯 HTML 片段，无 `<html>`/`<head>`/`<body>`）
2. 在 `example-slides/slides.js` 的 `SLIDES` 数组中添加路径
3. 使用 `utils/theme.css` 中的布局类编写内容：

| 布局类 | 用途 |
|--------|------|
| `.layout-cover` | 封面页 |
| `.slide-content` | 通用内容页（最常用） |
| `.layout-section` | 节标题过渡页 |
| `.layout-image-right/left` | 图文混排 |
| `.layout-quote` | 金句/强调页 |
| `.layout-stats` | 数据统计 |
| `.layout-timeline` | 时间线/流程 |
| `.layout-dashboard` | 图表仪表盘 |
| `.layout-closing` | 结束/Q&A 页 |

## AI 协作指引

AI 直接修改 `example-slides/` 下的 HTML 文件即可——保存后浏览器会在 2.5s 内自动检测并刷新对应页面，无需手动操作。

生成 slide 时应：
- 参照 `example-slides/slides.js` 中的 `GLOBAL_CONFIG`（比例、边距等）
- 使用 `utils/theme.css` 提供的 CSS 变量（`--accent`、`--text`、`--surface` 等）和布局类
- 只输出纯 HTML 片段，不包含 `<style>` 或 `<script>`
- 参考 `example-slides/` 下的示例了解各布局的正确写法
- Plotly 图表用 `data-plotly-config='{"data":[...],"layout":{...}}'` 可支持任意图型（violin、barpolar、sunburst 等），`layout` 中不必重复声明背景/字体等，`baseLayout()` 已自动注入

## 快捷键

| 按键 | 功能 |
|------|------|
| `→` `↓` `空格` | 下一页 |
| `←` `↑` | 上一页 |
| `Ctrl+S` | 保存所有页面 |
| `Ctrl+Z` | 撤销 |
| `Ctrl+Shift+Z` | 重做 |
| `Esc` | 退出编辑/文字编辑模式 |
| `Delete` | 删除选中元素 |
| `Ctrl+C` / `Ctrl+V` | 复制/粘贴元素 |
