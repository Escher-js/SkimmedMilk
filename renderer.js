const fileBtn = document.getElementById('file-btn');
const saveBtn = document.getElementById('save-btn');
const gitInitBtn = document.getElementById('git-init-btn');
const textEditor = document.getElementById('text-editor');
const folderPathSpan = document.getElementById('folder-path');
const gitStatusSpan = document.getElementById('git-status');
const branchSelect = document.getElementById('branch-select');

const path = require('path');
const appPath = '/Users/ti/Documents/code/sample';//path.dirname(require.main.filename);
const bodyMdPath = path.join(appPath, 'body.md');
let currentFilePath = null;

// body.mdファイルを作成または読み込む
async function loadBodyMd() {
    if (!fs.existsSync(bodyMdPath)) {
        fs.writeFileSync(bodyMdPath, '', 'utf8');
    }

    const fileContent = await fs.promises.readFile(bodyMdPath, 'utf8');
    const textEditor = document.getElementById('text-editor');
    textEditor.value = fileContent;
}
(async () => {
    // body.mdファイルを読み込む
    await loadBodyMd();
})();

fileBtn.addEventListener('click', () => {
    ipcRenderer.send('open-file-dialog');
});
saveBtn.addEventListener('click', () => {
    commitChanges();
});
gitInitBtn.addEventListener('click', () => {
    ipcRenderer.send('open-folder-dialog');
});
branchSelect.addEventListener('change', async () => {
    const selectedBranch = branchSelect.options[branchSelect.selectedIndex].value;
    const folderPath = folderPathSpan.textContent;

    if (selectedBranch === 'create-new-branch') {
        // show-branch-input-dialogを待機するPromiseを定義
        const waitForBranchInputDialog = async () => {
            return new Promise((resolve) => {
                ipcRenderer.once('branch-input-dialog-closed', () => {
                    resolve();
                });
            });
        };

        // ダイアログが閉じるのを待つ
        await ipcRenderer.invoke('show-branch-input-dialog');
        await waitForBranchInputDialog();

        // ブランチリストを更新
        await updateBranchList();
        return;
    }
    // 選択されたブランチにチェックアウト
    await new Promise((resolve, reject) => {
        exec(`git -C "${folderPath}" checkout "${selectedBranch}"`, (error, stdout, stderr) => {
            if (error && error.code !== 0) {
                console.error(`Error: ${error.message}`);
                reject(error);
                return;
            }
            if (stderr) {
                console.error(`Stderr: ${stderr}`);
            }
            console.log(`Branch switched: ${stdout}`);
            resolve();
        });
    });

    // 最新のコミットからファイルを読み込み
    const fileContent = await new Promise((resolve, reject) => {
        fs.readFile(`${currentFilePath}`, 'utf-8', (error, data) => {
            if (error) {
                console.error(`Error: ${error.message}`);
                reject(error);
                return;
            }
            resolve(data);
        });
    });

    // テキストエディタにファイル内容を表示
    textEditor.value = fileContent;
    await showCommitList();
});
window.addEventListener('beforeunload', async (event) => {
    if (currentFilePath) {
        await commitChanges('Auto-commit on window close');
    }
});

function saveFile(filePath) {
    commitChanges()
}
function updateBranchList() {
    const folderPath = folderPathSpan.textContent;
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
        // const currentBranch = branches.find(branch => branch.startsWith('*')).slice(1).trim();
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
async function commitChanges() {
    const folderPath = folderPathSpan.textContent;
    // const currentBranch = branchSelect.options[branchSelect.selectedIndex].value;

    // 保存
    fs.writeFileSync(`${currentFilePath}`, textEditor.value);

    // git status を実行して変更を検出
    const gitStatus = await new Promise((resolve, reject) => {
        exec(`git -C "${folderPath}" status --porcelain`, (error, stdout, stderr) => {
            if (error) {
                reject(`Error: ${error.message}`);
                return;
            }
            if (stderr) {
                reject(`Stderr: ${stderr}`);
                return;
            }
            resolve(stdout);
        });
    });

    // 変更がある場合のみコミット
    if (gitStatus.trim() !== '') {
        const commitMessage = `Auto-commit on ${new Date().toLocaleString()}`;

        exec(
            `git -C "${folderPath}" add . && git -C "${folderPath}" commit -m "${commitMessage}"`,
            (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error: ${error.message}`);
                    return;
                }
                if (stderr) {
                    console.error(`Stderr: ${stderr}`);
                    return;
                }
                console.log(`Commit successful: ${stdout}`);
            }
        );
    } else {
        console.log('No changes detected');
    }
}
async function showCommitList() {
    // コミットリストを取得
    const commitLines = await getCommitList();

    // コミットリストを表示
    const commitListContainer = document.getElementById('commit-list');
    commitListContainer.innerHTML = '';

    commitLines.forEach((commit) => {
        console.log(commit)
        const listItem = document.createElement('li');
        listItem.textContent = commit; //`${commit.shortHash} - ${commit.message}`
        listItem.addEventListener('click', () => {
            const commitHash = commit.split(' ')[0];
            showSelectedCommit(commitHash);
        });
        // マウスオーバー時に差分を表示するイベントリスナーを追加
        listItem.addEventListener('mouseover', async () => {
            const commitHash = commit.split(' ')[0];
            const diff = await getCommitDiff(commitHash);
            showDiff(diff);
        });
        commitListContainer.appendChild(listItem);
    });

}
async function getCommitDiff(commitHash) {

    const folderPath = folderPathSpan.textContent;

    return new Promise((resolve, reject) => {
        console.log(commitHash)
        exec(`git -C "${folderPath}" show "${commitHash}"`, (error, stdout, stderr) => {
            if (error && error.code !== 0) {
                console.error(`Error: ${error.message}`);
                reject(error);
                return;
            }
            if (stderr) {
                console.error(`Stderr: ${stderr}`);
            }
            resolve(stdout);
        });
    });
}

function showDiff(diff) {
    const diffContainer = document.getElementById('diff-container');

    // 差分を HTML 形式に変換
    const htmlDiff = window.electronAPI.getDiffHtml(diff);

    // 変更点を横に並べて表示
    diffContainer.innerHTML = htmlDiff;
}



// function showDiff(diff) {
//     const diffContainer = document.getElementById('diff-container');

//     // 差分をHTML形式に変換
//     const htmlDiff = Diff2Html.getPrettyHtml(diff, {
//         inputFormat: 'diff',
//         showFiles: false,
//         matching: 'lines',
//         outputFormat: 'side-by-side',
//     });

//     // 変更点を横に並べて表示
//     diffContainer.innerHTML = htmlDiff;
// }
async function getCommitList() {
    const selectedBranch = branchSelect.options[branchSelect.selectedIndex].value;
    const folderPath = folderPathSpan.textContent;

    if (!folderPath || selectedBranch === 'create-new-branch') {
        return;
    }

    const commitLogOutput = await new Promise((resolve, reject) => {
        exec(`git -C "${folderPath}" log --pretty=format:"%h - %s" ${selectedBranch}`, (error, stdout, stderr) => {
            if (error && error.code !== 0) {
                console.error(`Error: ${error.message}`);
                reject(error);
                return;
            }
            if (stderr) {
                console.error(`Stderr: ${stderr}`);
            }
            resolve(stdout);
        });
    });
    return commitLogOutput.split('\n');

}
async function showSelectedCommit(commitHash) {
    const folderPath = folderPathSpan.textContent;
    const cloneFolderPath = path.join(appPath, 'temp-clone');

    // クローンフォルダが存在する場合は削除
    if (fs.existsSync(cloneFolderPath)) {
        await fs.promises.rm(cloneFolderPath, { recursive: true, force: true });
    }

    // クローンを作成
    await new Promise((resolve, reject) => {
        exec(`git -C "${folderPath}" clone . "${cloneFolderPath}"`, (error, stdout, stderr) => {
            if (error && error.code !== 0) {
                console.error(`Error: ${error.message}`);
                reject(error);
                return;
            }
            if (stderr) {
                console.error(`Stderr: ${stderr}`);
            }
            console.log(`Cloned repository: ${stdout}`);
            resolve();
        });
    });

    // 選択したコミットまで戻す
    await new Promise((resolve, reject) => {
        exec(`git -C "${cloneFolderPath}" checkout "${commitHash}"`, (error, stdout, stderr) => {
            if (error && error.code !== 0) {
                console.error(`Error: ${error.message}`);
                reject(error);
                return;
            }
            if (stderr) {
                console.error(`Stderr: ${stderr}`);
            }
            console.log(`Checked out commit: ${stdout}`);
            resolve();
        });
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
                });
            }
        } else {
            // .gitフォルダが存在する場合
            gitStatusSpan.innerHTML = '<span style="color: blue;">&#11044;</span>';
        }
        updateBranchList(folderPath);
    });
});
ipcRenderer.on('create-new-branch', (event, newBranchName) => {
    const folderPath = folderPathSpan.textContent;
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


setInterval(commitChanges, 60 * 1000);

