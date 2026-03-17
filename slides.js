// ═══════════════════════════════════════════════════
//  全局配置 — AI 生成幻灯片时的参照基准
//  修改此处后刷新页面生效；不建议使用编辑面板的滑条代替
// ═══════════════════════════════════════════════════
const GLOBAL_CONFIG = {
  title:       'Claude & Codex 培训',  // 浏览器标题和演示文稿名称
  aspectRatio: '16:9',  // 页面比例: '16:9' | '4:3' | '1:1' | '21:9'
  vPad:        64,      // 内容纵向边距（px）
  hPad:        100,     // 内容横向边距（px）
  baseFontSize: 16,     // 基础字号（px）
};

// 幻灯片顺序 — 调整顺序只需移动行，无需改其他文件
const SLIDES = [
  'example-slides/01-title/slide.html',
  'example-slides/02-what-is-claude/slide.html',
  'example-slides/03-capabilities/slide.html',
  'example-slides/04-claude-code/slide.html',
  'example-slides/05-use-cases/slide.html',
  'example-slides/06-start/slide.html',
  'example-slides/07-quote-demo/slide.html',
  'example-slides/08-image-demo/slide.html',   // 图文混排
  'example-slides/09-table-demo/slide.html',   // 数据表格
  'example-slides/10-code-styles/slide.html',  // 多语言代码块
  'example-slides/11-charts/slide.html',       // 复杂排版：折线图+柱状图+统计卡片
];
