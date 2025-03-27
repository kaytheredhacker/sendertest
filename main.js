const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

function createWindow() {
    const iconPath = path.resolve(__dirname, 'assets', 'icon.ico');

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        icon: iconPath
    });

    // Load the app
    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, 'build', 'index.html'));
    }

    // Handle window state
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Create window when app is ready
app.whenReady().then(createWindow);

// Quit when all windows are closed
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// Handle file dialogs
ipcMain.handle('select-file', async () => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: 'Text Files', extensions: ['txt', 'csv'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        return result.filePaths;
    } catch (error) {
        console.error('Error selecting file:', error);
        return [];
    }
});

ipcMain.handle('select-directory', async () => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory']
        });
        return result.filePaths;
    } catch (error) {
        console.error('Error selecting directory:', error);
        return [];
    }
});

// Handle app updates
ipcMain.handle('check-for-updates', async () => {
    // Implement update checking logic here
    return { hasUpdate: false, version: app.getVersion() };
});

// Handle app settings
ipcMain.handle('get-settings', async () => {
    // Implement settings retrieval logic here
    return {
        theme: 'light',
        language: 'en',
        notifications: true
    };
});

ipcMain.handle('save-settings', async (event, settings) => {
    // Implement settings save logic here
    return true;
});

// Handle system tray
let tray = null;
function createTray() {
    const { Tray, Menu } = require('electron');
    const iconPath = path.join(__dirname, 'assets', 'icon.ico');
    
    tray = new Tray(iconPath);
    
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show App', click: () => mainWindow.show() },
        { label: 'Hide App', click: () => mainWindow.hide() },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
    ]);
    
    tray.setToolTip('Email Sender');
    tray.setContextMenu(contextMenu);
    
    tray.on('click', () => {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    });
}

// Create tray when app is ready
app.whenReady().then(createTray);

// Handle auto-start
app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath('exe')
});