// ═══════════════════════════════════════════════════
//  全局配置 — AI 生成幻灯片时的参照基准
//  修改此处后刷新页面生效；不建议使用编辑面板的滑条代替
// ═══════════════════════════════════════════════════
const GLOBAL_CONFIG = {
  aspectRatio: '16:9',  // 页面比例: '16:9' | '4:3' | '1:1' | '21:9'
  vPad:        64,      // 内容纵向边距（px）
  hPad:        100,     // 内容横向边距（px）
  baseFontSize: 16,     // 基础字号（px）
};

// 幻灯片顺序 — 调整顺序只需移动行，无需改其他文件
const SLIDES = [
  'slides/01-title/slide.html',
  'slides/02-what-is-claude/slide.html',
  'slides/03-capabilities/slide.html',
  'slides/04-claude-code/slide.html',
  'slides/05-use-cases/slide.html',
  'slides/06-start/slide.html',
  'slides/07-quote-demo/slide.html',
];
