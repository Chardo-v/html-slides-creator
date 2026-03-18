// ═══════════════════════════════════════════════════
//  全局配置 — AI 生成幻灯片时的参照基准
//  修改此处后刷新页面生效；不建议使用编辑面板的滑条代替
// ═══════════════════════════════════════════════════
const GLOBAL_CONFIG = {
  title:       '演示文稿标题',  // 浏览器标题和演示文稿名称
  aspectRatio: '16:9',          // 页面比例: '16:9' | '4:3' | '1:1' | '21:9'
  vPad:        64,              // 内容纵向边距（px）
  hPad:        100,             // 内容横向边距（px）
  baseFontSize: 16,             // 基础字号（px）
};

// 幻灯片顺序 — 调整顺序只需移动行，无需改其他文件
const SLIDES = [
  'example-slides/01-cover.html',       // 封面页
  'example-slides/02-agenda.html',      // 目录页
  'example-slides/03-section.html',     // 节标题页（反色过渡）
  'example-slides/04-bullets.html',     // 要点页（含 .tag 章节标签）
  'example-slides/05-image-text.html',  // 图文排版（图在右）
  'example-slides/06-chart.html',       // 图表页（柱状图）
  'example-slides/07-table.html',       // 表格页
  'example-slides/08-diagram.html',     // 逻辑图示（三列卡片）
  'example-slides/09-quote.html',       // 金句/强调页
  'example-slides/10-closing.html',     // 结束/Q&A 页
];
