// Push ui.* config values into CSS variables (live).
const MAP = {
  'ui.ink': '--ink', 'ui.panel': '--panel', 'ui.panel2': '--panel-2', 'ui.line': '--line',
  'ui.accent': '--accent', 'ui.blue': '--blue', 'ui.red': '--red', 'ui.green': '--green', 'ui.tan': '--tan',
};

export function applyTokens(C, root = document.documentElement) {
  for (const [k, v] of Object.entries(MAP)) root.style.setProperty(v, C(k));
  root.style.setProperty('--hud-scale', C('ui.scale'));
  root.style.setProperty('--btn-size', `${C('ui.btnSize')}px`);
  root.style.setProperty('--joy-size', `${C('ui.joySize')}px`);
  root.style.setProperty('--radius', `${C('ui.radius')}px`);
}

export function bindTokens(cfg, root) {
  applyTokens(cfg.get, root);
  cfg.onChange((key) => { if (!key || key.startsWith('ui.')) applyTokens(cfg.get, root); });
}
