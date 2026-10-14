// Top-down map schematic (arena select screen, design sheet): pitch, terrain
// zones, centre markings and obstacles (dark = tall cover, stone = low wall).
import { resolveMap, isCircle } from '../game/maps.js';
import { THEMES } from '../engine/themes.js';

export function drawSchematic(cv, mapId, C, mul = 1, px = 4) {
  const M = resolveMap(mapId, C, mul);
  const T = THEMES[M.theme] || THEMES.temple;
  const pad = 2;
  cv.width = M.W * px + pad * 2; cv.height = M.D * px + pad * 2;
  const g = cv.getContext('2d');
  g.fillStyle = T.plinth; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = T.ground; g.fillRect(pad, pad, M.W * px, M.D * px);
  const X = (x) => pad + (x + M.W / 2) * px, Z = (z) => pad + (z + M.D / 2) * px;
  for (const q of M.zones) {
    g.fillStyle = (T.zone[q.kind] || ['#888'])[q.kind === 'boost' ? 1 : 0];
    g.fillRect(Math.round(X(q.x - q.w / 2)), Math.round(Z(q.z - q.d / 2)), Math.round(q.w * px), Math.round(q.d * px));
  }
  g.fillStyle = T.lineMid; g.fillRect(Math.round(X(0)) - 1, pad, 2, M.D * px);
  g.strokeStyle = T.circle; g.lineWidth = Math.max(1, px / 3);
  g.beginPath(); g.arc(X(0), Z(0), 2.2 * px, 0, Math.PI * 2); g.stroke();
  for (const o of M.obstacles) {
    g.fillStyle = o.h >= 1 ? '#1a1f30' : T.obs.stoneDark;
    if (isCircle(o)) { g.beginPath(); g.arc(X(o.x), Z(o.z), Math.max(1.5, o.r * px), 0, Math.PI * 2); g.fill(); }
    else g.fillRect(Math.round(X(o.x - o.w / 2)), Math.round(Z(o.z - o.d / 2)), Math.max(2, Math.round(o.w * px)), Math.max(2, Math.round(o.d * px)));
  }
  g.strokeStyle = T.lineA; g.lineWidth = 1; g.strokeRect(pad + 0.5, pad + 0.5, M.W * px - 1, M.D * px - 1);
  return M;
}
