import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const LOCKED = resolve(__dirname, 'config/locked.json');
const HISTORY = resolve(__dirname, 'config/history');

// Dev-only API: the editor "Lock" button writes tuned values to disk so they
// become the game's baseline (and so Claude can read them next session).
function lockApi() {
  return {
    name: 'ghost-ball-lock-api',
    configureServer(server) {
      server.middlewares.use('/api/config', (req, res) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(fs.existsSync(LOCKED) ? fs.readFileSync(LOCKED, 'utf8') : '{}');
          return;
        }
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const stamp = new Date().toISOString().replace(/[:.]/g, '-');
              fs.mkdirSync(HISTORY, { recursive: true });
              fs.writeFileSync(LOCKED, JSON.stringify(data.values, null, 2));
              fs.writeFileSync(resolve(HISTORY, `${stamp}.json`), JSON.stringify(data, null, 2));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, file: 'config/locked.json', history: `config/history/${stamp}.json` }));
            } catch (e) {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, error: String(e) }));
            }
          });
          return;
        }
        res.statusCode = 405;
        res.end();
      });
    },
  };
}

export default defineConfig({
  base: './', // relative asset URLs so the build works when hosted under any path
  plugins: [lockApi()],
  cacheDir: process.env.GHOST_VITE_CACHE || resolve(os.homedir(), 'Library/Developer/CodexBuilds/ghost-ball/vite-cache'),
  // Locking writes config/*.json — don't let that hot-reload open pages.
  server: { port: 5173, watch: { ignored: ['**/config/**'] } },
  build: {
    outDir: process.env.GHOST_BUILD_DIR || resolve(os.homedir(), 'Library/Developer/CodexBuilds/ghost-ball/dist'),
    emptyOutDir: true,
    target: 'es2022', // top-level await; Safari 15+ / iOS 15+
    rollupOptions: {
      input: {
        game: resolve(__dirname, 'index.html'),
        art: resolve(__dirname, 'art.html'),
        showcase: resolve(__dirname, 'showcase.html'),
        device: resolve(__dirname, 'device.html'),
        editor: resolve(__dirname, 'editor.html'),
        sheet: resolve(__dirname, 'sheet.html'),
      },
    },
  },
});
