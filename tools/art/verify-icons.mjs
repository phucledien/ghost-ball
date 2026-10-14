// Source-contract check for the hand-authored icon family. No browser needed.
import assert from 'node:assert/strict';
import { ICONS, ICON_SIZE, SKILL_ICON, drawIcon } from '../../src/ui/icons.js';
import { ITEM_IDS } from '../../src/game/items.js';

assert.equal(ICON_SIZE, 16);
assert.equal(Object.keys(ICONS).length, 21);
for (const [name, grid] of Object.entries(ICONS)) {
  assert.equal(grid.length, ICON_SIZE, `${name}: rows`);
  for (const row of grid) {
    assert.equal(row.length, ICON_SIZE, `${name}: columns`);
    assert.match(row, /^[.oabdw]+$/, `${name}: palette`);
  }
  assert.equal(grid[0] + grid[15], '.'.repeat(32), `${name}: vertical gutter`);
  assert.ok(grid.every(row => row[0] === '.' && row[15] === '.'), `${name}: horizontal gutter`);
  for (const px of [1, 2, 4]) {
    let cells = 0;
    const ctx = {
      set fillStyle(value) { assert.ok(value, `${name}: resolved color`); },
      fillRect(x, y, w, h) {
        assert.equal(x % px, 0); assert.equal(y % px, 0);
        assert.equal(w, px); assert.equal(h, px); cells++;
      },
    };
    drawIcon(ctx, name, '#2f6fe0', px);
    assert.equal(cells, grid.join('').replaceAll('.', '').length, `${name}: painted cells`);
  }
}
assert.equal(new Set(Object.values(ICONS).map(grid => grid.join(''))).size, 21, 'distinct silhouettes');
for (const name of [...ITEM_IDS, ...Object.values(SKILL_ICON), 'ball', 'crown', 'skull']) {
  assert.ok(ICONS[name], `${name}: catalog coverage`);
}
console.log('PASS: 21 unique 16×16 icons; 1px gutters; all items/skills; integer paint at 1×/2×/4×.');
