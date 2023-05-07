const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            preload: path.join(__dirname, 'preload.js'),
        }
    });
    ipcMain.on('create-new-branch', (event, newBranchName) => {
        console.error(newBranchName)
        win.webContents.send('create-new-branch', newBranchName);
    });
    win.loadFile('index.html');
}
function createBranchInputDialog() {
    const inputDialog = new BrowserWindow({
        width: 400,
        height: 200,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    inputDialog.loadFile(path.join(__dirname, 'branch_input.html'));
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
ipcMain.handle('show-branch-input-dialog', () => {
    createBranchInputDialog();
});
