// Builds a self-contained web bundle in dist-web/ for both Rust/Tauri v2 and Capacitor 6 Android APK.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist-web');

console.log('Building self-contained web bundle in dist-web/ ...');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

// 1. Copy src/* -> dist-web/*
fs.cpSync(path.join(root, 'src'), out, { recursive: true });

// 2. Copy data/* -> dist-web/data/*
fs.cpSync(path.join(root, 'data'), path.join(out, 'data'), { recursive: true });

// 3. Copy top-level assets/* -> dist-web/assets/* (fonts, icon, method.png)
fs.cpSync(path.join(root, 'assets'), path.join(out, 'assets'), { recursive: true });

// 4. Rewrite relative ../assets/ and ../../data/ / ../../../data/ paths inside dist-web for flat root serving
function rewriteFile(relPath, replacements) {
  const full = path.join(out, relPath);
  if (!fs.existsSync(full)) return;
  let txt = fs.readFileSync(full, 'utf8');
  for (const [from, to] of replacements) {
    txt = txt.replaceAll(from, to);
  }
  fs.writeFileSync(full, txt, 'utf8');
}

rewriteFile('index.html', [
  ['href="../assets/', 'href="./assets/'],
  ["default-src 'self' file:;", "default-src 'self' file: tauri: http://tauri.localhost https://tauri.localhost;"],
  ["connect-src 'self' file: blob:;", "connect-src 'self' file: blob: tauri: http://tauri.localhost https://tauri.localhost ipc: http://ipc.localhost;"],
  ["img-src 'self' file: data:;", "img-src 'self' file: data: tauri: http://tauri.localhost https://tauri.localhost;"],
  ["font-src 'self' file:;", "font-src 'self' file: tauri: http://tauri.localhost https://tauri.localhost;"],
  ["media-src 'self' file: blob:;", "media-src 'self' file: blob: tauri: http://tauri.localhost https://tauri.localhost;"],
]);
rewriteFile('styles/fonts.css', [['../../assets/fonts/', '../assets/fonts/']]);
rewriteFile('js/store.js', [['../../data/chunks.json', '../data/chunks.json']]);
rewriteFile('js/screens/library.js', [['../../../data/library.json', '../../data/library.json']]);
rewriteFile('js/screens/method.js', [['../assets/method.png', './assets/method.png']]);

// Also copy Tauri icons into src-tauri/icons/
const tauriIcons = path.join(root, 'src-tauri', 'icons');
fs.mkdirSync(tauriIcons, { recursive: true });
for (const name of ['icon.ico', 'icon.png']) {
  const srcIco = path.join(root, 'assets', name);
  if (fs.existsSync(srcIco)) {
    fs.copyFileSync(srcIco, path.join(tauriIcons, name));
  }
}

console.log('dist-web/ bundle ready ✅');
