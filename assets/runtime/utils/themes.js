// ═══════════════════════════════════════════════════
//  主题定义 — 新增主题只需在 THEMES 数组末尾追加一项
// ═══════════════════════════════════════════════════
const THEMES = [
  {
    id: 'dawn', name: '晨曦',
    swatches: ['#f0a080','#c8a0e8','#90c8f0','#f0d088'],
    vars: {
      '--bg-base':   '#f2ede8',
      '--panel-bg':  'rgba(248,244,240,0.96)',
      '--surface':   'rgba(255,255,255,0.52)',
      '--accent':    '#c05530',
      '--accent-dim':'rgba(192,85,48,0.12)',
      '--border':    'rgba(0,0,0,0.09)',
      '--text':      '#1e1820',
      '--muted':     'rgba(30,24,32,0.48)',
      '--blob1':'#f0a080', '--blob2':'#c8a0e8',
      '--blob3':'#90c8f0', '--blob4':'#f0d088',
    },
  },
  {
    id: 'dusk', name: '暮色',
    swatches: ['#c04828','#5530a0','#1a3a8a','#8a5018'],
    vars: {
      '--bg-base':   '#09090f',
      '--panel-bg':  'rgba(10,10,20,0.96)',
      '--surface':   'rgba(22,22,36,0.65)',
      '--accent':    '#d97757',
      '--accent-dim':'rgba(217,119,87,0.15)',
      '--border':    'rgba(255,255,255,0.08)',
      '--text':      '#f0ede8',
      '--muted':     'rgba(240,237,232,0.5)',
      '--blob1':'#c04828', '--blob2':'#5530a0',
      '--blob3':'#1a3a8a', '--blob4':'#8a5018',
    },
  },
  {
    id: 'aurora', name: '极光',
    swatches: ['#106050','#1828a0','#600880','#087890'],
    vars: {
      '--bg-base':   '#050a10',
      '--panel-bg':  'rgba(5,10,18,0.96)',
      '--surface':   'rgba(8,20,38,0.65)',
      '--accent':    '#40c8a0',
      '--accent-dim':'rgba(64,200,160,0.15)',
      '--border':    'rgba(255,255,255,0.08)',
      '--text':      '#e0f8f0',
      '--muted':     'rgba(224,248,240,0.5)',
      '--blob1':'#106050', '--blob2':'#1828a0',
      '--blob3':'#600880', '--blob4':'#087890',
    },
  },
  {
    id: 'field', name: '稻田',
    swatches: ['#a0d060','#f0d050','#60b870','#c8e860'],
    vars: {
      '--bg-base':   '#f0f4e4',
      '--panel-bg':  'rgba(242,248,234,0.96)',
      '--surface':   'rgba(255,255,255,0.55)',
      '--accent':    '#4a7828',
      '--accent-dim':'rgba(74,120,40,0.12)',
      '--border':    'rgba(0,0,0,0.09)',
      '--text':      '#182010',
      '--muted':     'rgba(24,32,16,0.48)',
      '--blob1':'#a0d060', '--blob2':'#f0d050',
      '--blob3':'#60b870', '--blob4':'#c8e860',
    },
  },
  {
    id: 'ink', name: '墨白',
    swatches: ['#d8d8d8','#b8b8c8','#e0e0e0','#c8c8c8'],
    vars: {
      '--bg-base':   '#f5f5f5',
      '--panel-bg':  'rgba(252,252,252,0.97)',
      '--surface':   'rgba(255,255,255,0.65)',
      '--accent':    '#1a1a1a',
      '--accent-dim':'rgba(26,26,26,0.08)',
      '--border':    'rgba(0,0,0,0.1)',
      '--text':      '#0a0a0a',
      '--muted':     'rgba(10,10,10,0.45)',
      '--blob1':'#d8d8d8', '--blob2':'#b8b8c8',
      '--blob3':'#e0e0e0', '--blob4':'#c8c8c8',
    },
  },
];

function applyTheme(id) {
  const theme = THEMES.find(t => t.id === id) ?? THEMES[0];
  const root  = document.documentElement;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  document.getElementById('bg').style.background = theme.vars['--bg-base'];
  localStorage.setItem('pres-theme', id);
  document.querySelectorAll('.theme-card')
    .forEach(el => el.classList.toggle('active', el.dataset.id === id));
}
