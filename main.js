const { app, BrowserWindow, ipcMain, dialog } = require('electron');
// const { exec } = require('child_process');
const fs = require('fs')
const path = require('path')
const util = require('util')
const exec = util.promisify(require('child_process').exec)

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

async function commitChanges(event, message, folderPath) {
    const gitStatusOutput = (await exec(`git -C "${folderPath}" status --porcelain`)).stdout
    const changes = gitStatusOutput.split('\n').filter(line => line.trim() !== '')

    if (changes.length > 0) {
        for (const change of changes) {
            const filePath = path.join(folderPath, change.substring(3));
            const fileSizeInBytes = fs.statSync(filePath).size;
            const fileSizeInMegabytes = fileSizeInBytes / (1024 * 1024);

            if (fileSizeInMegabytes > 1) {
                await exec(`git lfs track "${filePath}"`);
                await exec(`git -C "${folderPath}" add "${filePath}"`);
            } else {
                await exec(`git -C "${folderPath}" add "${filePath}"`);
            }
        }

        const commitResult = (await exec(`git -C "${folderPath}" commit -m "${message}"`)).stdout
        event.reply('commitChanges-reply', commitResult);
    } else {
        event.reply('commitChanges-reply', 'No changes detected');
    }
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

ipcMain.on('commitChanges', commitChanges)

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
ipcMain.on('open-folder-dialog', async (event) => {
    const options = {
        title: 'Select a folder',
        properties: ['openDirectory'],
    };

    const result = await dialog.showOpenDialog(null, options);

    if (!result.canceled) {
        const folderPath = result.filePaths[0];
        const gitFolderPath = path.join(folderPath, '.git');

        let isGitRepo = false;
        if (fs.existsSync(gitFolderPath)) {
            isGitRepo = true;
        }

        if (!isGitRepo) {
            const result = await exec(`git -C "${folderPath}" init`);
            await exec(`git -C "${folderPath}" checkout -b main`);
        }
        console.log('result:', result)
        event.sender.send('selected-folder', { folderPath, isGitRepo });
    }
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
ipcMain.handle('update-branch-list', async (event, folderPath) => {
    const branchList = (await exec(`git -C "${folderPath}" branch`)).stdout;
    const branches = branchList.split('\n').filter(line => line.trim() !== '').map(branch => branch.trim());

    return branches;
});

ipcMain.handle('show-commit-list', async (event, folderPath, selectedBranch) => {
    if (!folderPath || selectedBranch === 'create-new-branch') {
        console.log(`selected branch is ${selectedBranch}`);
        return;
    }

    const options = '--pretty=format:"%cd - %h - %s %d" --decorate=short'
    const commitLogOutput = (await exec(`git -C "${folderPath}" log ${options} ${selectedBranch}`)).stdout;

    return commitLogOutput.split('\n');
});
