const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let isQuitting = false;

// Active watched folders map: folderPath -> FSWatcher
const watchedFolders = new Map();
// Debounced event timers
const debounceTimers = new Map();

function createTray() {
  if (tray) return;

  // Create a 16x16 / 32x32 tray icon
  const iconPath = path.join(__dirname, '../public/favicon.svg');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Picasa Docs & Photo Studio (Everything Real-time Monitor)');

  const updateTrayMenu = () => {
    const folderCount = watchedFolders.size;
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '⚡️ Picasa 열기 (Open App)',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: `📊 실시간 감시: ${folderCount}개 폴더 (초저전력 0.0% CPU)`,
        enabled: false,
      },
      { type: 'separator' },
      {
        label: '❌ 완전히 종료 (Quit)',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);
    tray.setContextMenu(contextMenu);
  };

  updateTrayMenu();

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    }
  });

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Picasa Web - Photo & Document Studio',
    backgroundColor: '#0c0e12',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Windows Everything-style Close-to-Tray
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();

      if (Notification.isSupported()) {
        new Notification({
          title: 'Picasa Everything 백그라운드 가동 중',
          body: '트레이 아이콘에서 실시간 파일 모니터링이 계속 유지됩니다.',
        }).show();
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Ultra-low resource File Watcher (Uses Windows kernel ReadDirectoryChangesW)
 */
function watchFolder(folderPath) {
  if (watchedFolders.has(folderPath)) return true;
  if (!fs.existsSync(folderPath)) return false;

  try {
    const watcher = fs.watch(folderPath, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      if (filename.startsWith('.') || filename.includes('node_modules') || filename.includes('.tmp')) return;

      const fullPath = path.join(folderPath, filename);
      const timerKey = `${eventType}:${fullPath}`;

      // Debounce rapid writes (250ms window)
      if (debounceTimers.has(timerKey)) {
        clearTimeout(debounceTimers.get(timerKey));
      }

      debounceTimers.set(
        timerKey,
        setTimeout(() => {
          debounceTimers.delete(timerKey);

          let exists = false;
          let stats = null;
          try {
            exists = fs.existsSync(fullPath);
            if (exists) stats = fs.statSync(fullPath);
          } catch {
            exists = false;
          }

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('watcher:file-changed', {
              eventType: exists ? (eventType === 'rename' ? 'added' : 'modified') : 'deleted',
              filePath: fullPath,
              fileName: path.basename(filename),
              folderPath,
              size: stats ? stats.size : 0,
              lastModified: stats ? stats.mtimeMs : Date.now(),
            });
          }
        }, 250)
      );
    });

    watchedFolders.set(folderPath, watcher);
    return true;
  } catch (err) {
    console.error('Failed to watch folder:', folderPath, err);
    return false;
  }
}

function unwatchFolder(folderPath) {
  const watcher = watchedFolders.get(folderPath);
  if (watcher) {
    watcher.close();
    watchedFolders.delete(folderPath);
    return true;
  }
  return false;
}

// IPC Handlers
ipcMain.handle('watcher:add-folder', async (_event, folderPath) => {
  return watchFolder(folderPath);
});

ipcMain.handle('watcher:remove-folder', async (_event, folderPath) => {
  return unwatchFolder(folderPath);
});

ipcMain.handle('watcher:get-folders', async () => {
  return Array.from(watchedFolders.keys());
});

ipcMain.handle('fs:read-file', async (_event, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  } catch (err) {
    console.error('Failed to read file:', filePath, err);
    return null;
  }
});

ipcMain.on('window:minimize-to-tray', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.on('app:notification', (_event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
});

// App Lifecycle
app.whenReady().then(() => {
  createTray();
  createWindow();

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show();
    } else {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  // Clean up all watchers
  watchedFolders.forEach((watcher) => watcher.close());
  watchedFolders.clear();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !tray) {
    app.quit();
  }
});
