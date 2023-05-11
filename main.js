const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let mainWindow;
let newBranchWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: true,
            preload: path.join(__dirname, 'preload.js'), // preloadスクリプトのパスを追加
        },
    });
    mainWindow.loadFile('index.html');
}
function createBranchInputDialog() {
    if (newBranchWindow) {
        newBranchWindow.close();
    }
    newBranchWindow = new BrowserWindow({
        width: 400,
        height: 200,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: true,
            preload: path.join(__dirname, 'preload.js'), // preloadスクリプトのパスを追加
        },
    });
    newBranchWindow.loadFile(path.join(__dirname, 'branch_input.html'));
}

// Gitコマンドを実行する関数
function runGitCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

app.whenReady().then(async () => {
    createWindow();
    try {
        const [username, email] = await Promise.all([
            runGitCommand('git config --global user.name'),
            runGitCommand('git config --global user.email'),
        ]);

        if (!username || !email) {
            throw new Error('Username or email not set');
        }
    } catch (error) {
        // 設定が不完全な場合、設定画面を表示
        const win = new BrowserWindow({
            parent: mainWindow,
            modal: true,
            width: 400,
            height: 300,
            backgroundColor: '#ffffff',
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js'), // preloadスクリプトのパスを追加
            },
        });
        win.loadFile('gitconfig.html');
    }
});

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
ipcMain.on('created-new-branch', (event, newBranchName) => {
    console.log(newBranchName);
    if (mainWindow) {
        mainWindow.webContents.send('created-new-branch', newBranchName);
    }
});
ipcMain.handle('show-branch-input-dialog', () => {
    createBranchInputDialog();
});
ipcMain.handle('set-git-config', async (event, username, email) => {
    try {
        await Promise.all([
            runGitCommand(`git config --global user.name "${username}"`),
            runGitCommand(`git config --global user.email "${email}"`),
        ]);
        return 'success';
    } catch (error) {
        return error.message;
    }
});