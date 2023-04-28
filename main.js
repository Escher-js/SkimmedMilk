const { app, BrowserWindow, ipcMain, dialog } = require('electron');

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
    });

    win.loadFile('index.html');
}

app.whenReady().then(createWindow);

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

ipcMain.on('open-folder-dialog', (event) => {
    const options = {
        title: 'Select a folder',
        properties: ['openDirectory'],
    };

    dialog.showOpenDialog(null, options).then((result) => {
        if (!result.canceled) {
            const folderPath = result.filePaths[0];
            event.sender.send('selected-folder', folderPath);
        }
    });
});
ipcMain.on('open-file-dialog', (event) => {
    const options = {
        title: 'Select a file',
        properties: ['openFile'],
        filters: [{ name: 'Markdown', extensions: ['md'] }],
    };

    dialog.showOpenDialog(null, options).then((result) => {
        if (!result.canceled) {
            const filePath = result.filePaths[0];
            event.sender.send('selected-file', filePath);
        }
    });
});

ipcMain.on('save-file-dialog', (event) => {
    const options = {
        title: 'Save file',
        filters: [{ name: 'Markdown', extensions: ['md'] }],
    };

    dialog.showSaveDialog(null, options).then((result) => {
        if (!result.canceled) {
            const savePath = result.filePath;
            event.sender.send('selected-save-path', savePath);
        }
    });
});
