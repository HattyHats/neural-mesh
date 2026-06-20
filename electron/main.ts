import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

let win: BrowserWindow | null;
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST, 'index.html'));
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);

// File System Bridge
ipcMain.handle('save-mesh-file', async (event, data: string) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win!, {
    title: 'Save Neural-Mesh Brain',
    defaultPath: 'my-brain.mesh',
    filters: [{ name: 'Neural-Mesh Files', extensions: ['mesh'] }]
  });
  if (!canceled && filePath) {
    fs.writeFileSync(filePath, data, 'utf-8');
    return filePath;
  }
  return null;
});

ipcMain.handle('open-mesh-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
    title: 'Open Neural-Mesh Brain',
    filters: [{ name: 'Neural-Mesh Files', extensions: ['mesh'] }],
    properties: ['openFile']
  });
  if (!canceled && filePaths.length > 0) {
    const data = fs.readFileSync(filePaths[0], 'utf-8');
    return data;
  }
  return null;
});
