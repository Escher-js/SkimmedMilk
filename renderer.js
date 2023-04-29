const { ipcRenderer, dialog } = require('electron');
const fs = require('fs');
const { exec } = require('child_process');
const { defaultGitignoreContent } = require('./gitignore_defaults');

const fileBtn = document.getElementById('file-btn');
const saveBtn = document.getElementById('save-btn');
const gitInitBtn = document.getElementById('git-init-btn');
const textEditor = document.getElementById('text-editor');
const folderPathSpan = document.getElementById('folder-path');
const gitStatusSpan = document.getElementById('git-status');
const branchSelect = document.getElementById('branch-select');

let currentFilePath = null;

fileBtn.addEventListener('click', () => {
    ipcRenderer.send('open-file-dialog');
});
saveBtn.addEventListener('click', () => {
    if (currentFilePath) {
        saveFile(currentFilePath);
    } else {
        ipcRenderer.send('save-file-dialog');
    }
});
gitInitBtn.addEventListener('click', () => {
    ipcRenderer.send('open-folder-dialog');
});
branchSelect.addEventListener('change', () => {
    if (branchSelect.value === 'create-new-branch') {
        ipcRenderer.invoke('show-branch-input-dialog');
        // プルダウンメニューの選択をリセット
        branchSelect.value = '';
    }
});

function saveFile(filePath) {
    const content = textEditor.value;
    fs.writeFile(filePath, content, (err) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log('File saved:', filePath);
    });
}
function updateBranchList(folderPath) {
    // ブランチの一覧を取得する
    exec(`git -C "${folderPath}" branch`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`Stderr: ${stderr}`);
            return;
        }
        console.log(stdout)
        const branches = stdout.split('\n').filter(line => line.trim() !== '').map(branch => branch.trim());
        const currentBranch = branches.find(branch => branch.startsWith('*')).slice(1).trim();
        console.log(branches)
        // プルダウンメニューをクリア
        branchSelect.innerHTML = '';

        // 新しいオプションを追加する
        branches.forEach(branch => {
            const option = document.createElement('option');
            option.value = branch.replace('*', '').trim();
            option.textContent = option.value;

            if (branch.startsWith('*')) {
                option.selected = true;
            }

            branchSelect.appendChild(option);
        });

        // 'Create new branch' オプションを追加
        const createNewBranchOption = document.createElement('option');
        createNewBranchOption.value = 'create-new-branch';
        createNewBranchOption.textContent = 'Create new branch';
        branchSelect.appendChild(createNewBranchOption);
    });
}


ipcRenderer.on('selected-file', (event, filePath) => {
    currentFilePath = filePath;
    fs.readFile(filePath, 'utf-8', (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        textEditor.value = data;
    });
});
ipcRenderer.on('selected-save-path', (event, savePath) => {
    currentFilePath = savePath;
    saveFile(currentFilePath);
});
ipcRenderer.on('selected-folder', (event, folderPath) => {
    // フォルダパスを表示
    folderPathSpan.textContent = folderPath;

    fs.access(`${folderPath}/.git`, fs.constants.F_OK, (err) => {
        if (err) {
            // .gitフォルダが存在しない場合
            gitStatusSpan.innerHTML = '<span style="color: red;">&#11044;</span>';

            const gitInitConfirmed = confirm('This folder is not a git repository. Do you want to run "git init"?');
            if (gitInitConfirmed) {
                exec(`git -C "${folderPath}" init`, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Error: ${error.message}`);
                        return;
                    }
                    if (stderr) {
                        console.error(`Stderr: ${stderr}`);
                        return;
                    }
                    console.log(`Stdout: ${stdout}`);
                    gitStatusSpan.innerHTML = '<span style="color: blue;">&#11044;</span>';

                    // .gitignoreファイルを作成して書き込む
                    fs.writeFile(`${folderPath}/.gitignore`, defaultGitignoreContent, (error) => {
                        if (error) {
                            console.error(`Error: ${error.message}`);
                            return;
                        }
                        console.log('Created .gitignore file');
                    });

                    // ブランチ一覧を更新
                    updateBranchList(folderPath);
                });
            }
        } else {
            // .gitフォルダが存在する場合
            gitStatusSpan.innerHTML = '<span style="color: blue;">&#11044;</span>';

            // ブランチ一覧を更新
            updateBranchList(folderPath);
        }
    });
});
ipcRenderer.on('create-new-branch', (event, newBranchName) => {
    const folderPath = folderPathSpan.textContent;
    console.error(folderPath, newBranchName)
    exec(`git -C "${folderPath}" checkout -b "${newBranchName.trim()}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`Stderr: ${stderr}`);
        }
        console.log(`Stdout: ${stdout}`);

        // ブランチ一覧を更新
        updateBranchList(folderPath);
    });
});