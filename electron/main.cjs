const { app, BrowserWindow, ipcMain, session, shell, Menu, dialog, screen } = require('electron');
const path = require('node:path');
const fsp = require('node:fs/promises');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..');
const IS_SHOT = Boolean(process.env.CHUNK_SHOT_DIR);
const SHOT_DIR = process.env.CHUNK_SHOT_DIR || '';

app.setName('ChunkTrainer');
app.setAppUserModelId('com.abdo.chunktrainer');

const USER_DIR = app.getPath('userData');
const STATE_FILE = path.join(USER_DIR, 'progress.json');
const BACKUP_DIR = path.join(USER_DIR, 'backups');
const WINDOW_FILE = path.join(USER_DIR, 'window.json');
const DATA_FILE = path.join(ROOT, 'data', 'chunks.json');

let win = null;
let lastBackupAt = 0;
let writeChain = Promise.resolve();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson(file, fallback = null) {
  try {
    const text = await fsp.readFile(file, 'utf8');
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(file, value) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const handle = await fsp.open(tmp, 'w');
  try {
    await handle.writeFile(JSON.stringify(value, null, 2), 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fsp.rename(tmp, file).catch(async () => {
    // Antivirus / OneDrive can briefly lock the target; copy and drop the temp file.
    await fsp.copyFile(tmp, file);
    await fsp.rm(tmp, { force: true });
  });
}

async function snapshotBackup() {
  const now = Date.now();
  if (now - lastBackupAt < 5 * 60 * 1000) return;
  const existing = await readJson(STATE_FILE);
  if (!existing) return;
  lastBackupAt = now;
  await fsp.mkdir(BACKUP_DIR, { recursive: true });
  const stamp = new Date(now).toISOString().replace(/[:.]/g, '-').slice(0, 19);
  await fsp.copyFile(STATE_FILE, path.join(BACKUP_DIR, `progress-${stamp}.json`));
  const files = (await fsp.readdir(BACKUP_DIR)).filter((f) => f.endsWith('.json')).sort();
  for (const stale of files.slice(0, Math.max(0, files.length - 12))) {
    await fsp.rm(path.join(BACKUP_DIR, stale), { force: true });
  }
}

function registerIpc() {
  ipcMain.handle('data:chunks', async () => readJson(DATA_FILE));

  ipcMain.handle('state:load', async () => {
    const state = await readJson(STATE_FILE);
    return { state, path: STATE_FILE, dir: USER_DIR };
  });

  ipcMain.handle('state:save', async (_event, state) => {
    if (!state || typeof state !== 'object') return { ok: false, error: 'bad-state' };
    const job = async () => {
      await snapshotBackup();
      const payload = { ...state, updatedAt: new Date().toISOString() };
      await writeJsonAtomic(STATE_FILE, payload);
      return { ok: true, savedAt: payload.updatedAt };
    };
    writeChain = writeChain.then(job, job);
    return writeChain;
  });

  ipcMain.handle('state:export', async () => {
    const result = await dialog.showSaveDialog(win, {
      title: 'تصدير التقدم',
      defaultPath: path.join(app.getPath('documents'), `chunk-progress-${new Date().toISOString().slice(0, 10)}.json`),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    const state = await readJson(STATE_FILE);
    await writeJsonAtomic(result.filePath, state ?? {});
    return { ok: true, filePath: result.filePath };
  });

  ipcMain.handle('state:import', async () => {
    const result = await dialog.showOpenDialog(win, {
      title: 'استيراد ملف تقدم',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };
    const imported = await readJson(result.filePaths[0]);
    if (!imported || typeof imported !== 'object' || !imported.chunks) {
      return { ok: false, error: 'الملف مش ملف تقدم صالح' };
    }
    await writeJsonAtomic(STATE_FILE, imported);
    return { ok: true, state: imported, filePath: result.filePaths[0] };
  });

  ipcMain.handle('state:reset', async () => {
    await snapshotBackup();
    await fsp.rm(STATE_FILE, { force: true });
    return { ok: true };
  });

  ipcMain.handle('shell:open-data-folder', async () => {
    await fsp.mkdir(USER_DIR, { recursive: true });
    await shell.openPath(USER_DIR);
    return { ok: true };
  });

  ipcMain.handle('app:info', async () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    userDir: USER_DIR,
    stateFile: STATE_FILE,
    backupDir: BACKUP_DIR,
    root: ROOT,
  }));
}

async function createWindow() {
  const saved = await readJson(WINDOW_FILE);
  const fallback = { width: 1320, height: 880 };
  let bounds = fallback;

  if (saved && Number.isFinite(saved.width) && Number.isFinite(saved.height)) {
    const wideEnough = saved.width >= 900 && saved.height >= 600;
    const onScreen =
      Number.isFinite(saved.x) &&
      Number.isFinite(saved.y) &&
      screen.getAllDisplays().some((display) => {
        const area = display.workArea;
        return (
          saved.x + saved.width > area.x + 40 &&
          saved.x < area.x + area.width - 40 &&
          saved.y + saved.height > area.y + 40 &&
          saved.y < area.y + area.height - 40
        );
      });
    if (wideEnough && onScreen) bounds = saved;
  }

  win = new BrowserWindow({
    ...bounds,
    minWidth: 980,
    minHeight: 680,
    show: false,
    backgroundColor: '#e9eff5',
    title: 'دفتر الشانكس',
    icon: path.join(ROOT, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.loadFile(path.join(ROOT, 'src', 'index.html'), { hash: '/home' });

  const reveal = () => {
    if (!win || win.isDestroyed()) return;
    win.show();
    if (win.isMinimized()) win.restore();
    win.show();
    win.webContents.executeJavaScript('window.scrollTo(0, 0)').catch(() => {});
    if (!IS_SHOT) win.focus();
  };

  win.once('ready-to-show', reveal);
  win.webContents.once('did-finish-load', () => setTimeout(reveal, 350));
  setTimeout(reveal, 2500);

  win.on('close', async () => {
    try {
      if (!win.isDestroyed() && !win.isMinimized()) {
        const { x, y, width, height } = win.getBounds();
        if (width >= 900 && height >= 600) {
          await writeJsonAtomic(WINDOW_FILE, { x, y, width, height });
        }
      }
    } catch {
      /* window geometry is a nicety, never block quitting */
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const dev = !app.isPackaged || process.env.CHUNK_DEV === '1';
    if (input.key === 'F12' && dev) {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
    if ((input.control && input.key.toLowerCase() === 'r') || input.key === 'F5') {
      win.webContents.reload();
      event.preventDefault();
    }
  });

  win.webContents.on('did-finish-load', () => {
    if (IS_SHOT) runScreenshots();
  });

  win.webContents.on('console-message', (...args) => {
    const details = args[1];
    if (details && typeof details === 'object' && 'message' in details) {
      console.log(`[renderer:${details.level}] ${details.message} (${details.sourceId}:${details.lineNumber})`);
    } else {
      console.log('[renderer]', args[2], args[4] || '');
    }
  });

  win.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('preload error', preloadPath, error);
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('renderer gone', details);
  });
}

async function runScreenshots() {
  try {
    await fsp.mkdir(SHOT_DIR, { recursive: true });
    await delay(1400);
    await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)').catch(() => {});
    const routes = [
      ['01-home', '#/home'],
      ['02-level-a1', '#/level/A1'],
      ['03-practice-step1', '#/practice/A1-003?step=1'],
      ['04-practice-step3', '#/practice/A1-003?step=3'],
      ['05-practice-step5', '#/practice/A1-003?step=5'],
      ['06-review', '#/review'],
      ['07-stats', '#/stats'],
      ['08-settings', '#/settings'],
      ['09-method', '#/method'],
      ['10-home-dark', '#/home'],
    ];
    for (const [name, hash] of routes) {
      await win.webContents.executeJavaScript(`location.hash = ${JSON.stringify(hash)}`);
      await delay(name === '10-home-dark' ? 200 : 850);
      if (name === '10-home-dark') {
        await win.webContents.executeJavaScript(
          "document.documentElement.setAttribute('data-theme','dark')",
        );
        await delay(500);
      }
      const image = await win.webContents.capturePage();
      await fsp.writeFile(path.join(SHOT_DIR, `${name}.png`), image.toPNG());
      console.log('shot', name);
    }
  } catch (error) {
    console.error('screenshot failed', error);
  } finally {
    app.quit();
  }
}

async function cleanStaleTemps() {
  try {
    const files = await fsp.readdir(USER_DIR);
    await Promise.all(
      files.filter((file) => file.endsWith('.tmp')).map((file) => fsp.rm(path.join(USER_DIR, file), { force: true })),
    );
  } catch {
    /* first run: folder may not exist yet */
  }
}

const hasLock = app.requestSingleInstanceLock();

if (!hasLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(permission === 'media' || permission === 'audioCapture');
    });
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media');
    registerIpc();
    await cleanStaleTemps();
    await createWindow();
  });

  app.on('window-all-closed', () => app.quit());
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
