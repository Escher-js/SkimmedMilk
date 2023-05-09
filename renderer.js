const fileBtn = document.getElementById('file-btn');
const saveBtn = document.getElementById('save-btn');
const gitInitBtn = document.getElementById('git-init-btn');
const textEditor = document.getElementById('text-editor');
const folderPathSpan = document.getElementById('folder-path');
const gitStatusSpan = document.getElementById('git-status');
const branchSelect = document.getElementById('branch-select');

saveBtn.addEventListener('click', () => {
    commitChanges();
});
gitInitBtn.addEventListener('click', () => {
    window.electronAPI.send('open-folder-dialog');
});
branchSelect.addEventListener('change', async () => {
    const selectedBranch = branchSelect.options[branchSelect.selectedIndex].value;
    const folderPath = folderPathSpan.textContent;

    if (selectedBranch === 'create-new-branch') {
        // show-branch-input-dialogを待機するPromiseを定義
        const waitForBranchInputDialog = async () => {
            return new Promise((resolve) => {
                window.electronAPI.once('branch-input-dialog-closed', () => {
                    resolve();
                });
            });
        };

        // ダイアログが閉じるのを待つ
        await window.electronAPI.invoke('show-branch-input-dialog');
        await waitForBranchInputDialog();

        // ブランチリストを更新
        await updateBranchList();
        return;
    }
    // 選択されたブランチにチェックアウト
    await new Promise((resolve, reject) => {
        window.electronAPI.exec(`git -C "${folderPath}" checkout "${selectedBranch}"`, (error, stdout, stderr) => {
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
    await showCommitList();
});
window.addEventListener('beforeunload', async (event) => {
    const folderPath = folderPathSpan.textContent;
    if (folderPath) {
        await commitChanges('Auto-commit on window close');
        await showCommitList();
    }
});

async function saveFile() {
    await commitChanges()
    await showCommitList();
}
async function updateBranchList() {
    const folderPath = folderPathSpan.textContent;
    const stdout = await window.electronAPI.execAsync(`git -C "${folderPath}" branch`);

    const branches = stdout.split('\n').filter(line => line.trim() !== '').map(branch => branch.trim());
    console.log(branches);

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
}

async function commitChanges() {
    const folderPath = folderPathSpan.textContent;

    // git status を実行して変更を検出
    const gitStatus = await new Promise((resolve, reject) => {
        window.electronAPI.exec(`git -C "${folderPath}" status --porcelain`, (error, stdout, stderr) => {
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

        window.electronAPI.exec(
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
async function getCommitList() {
    const selectedBranch = branchSelect.options[branchSelect.selectedIndex].value;
    const folderPath = folderPathSpan.textContent;

    if (!folderPath || selectedBranch === 'create-new-branch') {
        return;
    }

    const commitLogOutput = await new Promise((resolve, reject) => {
        window.electronAPI.exec(`git -C "${folderPath}" log --pretty=format:"%h - %s" ${selectedBranch}`, (error, stdout, stderr) => {
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
function getParentFolderPath(path) {
    // パスの最後の区切り文字（/または\）を見つけます。
    const lastSeparatorIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));

    if (lastSeparatorIndex === -1) {
        // 区切り文字が見つからない場合、親フォルダが存在しないとみなします。
        return null;
    }

    // 区切り文字までの部分文字列を取得し、親フォルダのパスを返します。
    return path.substring(0, lastSeparatorIndex);
}
async function showSelectedCommit(commitHash) {
    const folderPath = folderPathSpan.textContent;
    const parentPath = getParentFolderPath(folderPath)
    const cloneFolderPath = window.electronAPI.joinPath(parentPath, 'temp-clone');

    // クローンフォルダが存在する場合は削除
    if (window.electronAPI.existsSync(cloneFolderPath)) {
        await window.electronAPI.rm(cloneFolderPath, { recursive: true, force: true });
    }

    // クローンを作成
    await new Promise((resolve, reject) => {
        window.electronAPI.exec(`git -C "${folderPath}" clone . "${cloneFolderPath}"`, (error, stdout, stderr) => {
            if (error && error.code !== 0) {
                console.error(`Error: ${error.message}`);
                reject(error);
                return;
            }
            if (stderr) {
                console.log(`Stderr: ${stderr}`);
            }
            console.log(`Cloned repository: ${stdout}`);
            resolve();
        });
    });

    // 選択したコミットまで戻す
    await new Promise((resolve, reject) => {
        window.electronAPI.exec(`git -C "${cloneFolderPath}" checkout "${commitHash}"`, (error, stdout, stderr) => {
            if (error && error.code !== 0) {
                console.error(`Error: ${error.message}`);
                reject(error);
                return;
            }
            if (stderr) {
                console.log(`Stderr: ${stderr}`);
            }
            console.log(`Checked out commit: ${stdout}`);
            resolve();
        });
    });
}
async function getCommitDiff(commitHash) {
    const folderPath = folderPathSpan.textContent;

    return new Promise((resolve, reject) => {
        console.log(commitHash)
        window.electronAPI.exec(`git -C "${folderPath}" show "${commitHash}"`, (error, stdout, stderr) => {
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
async function showDiff(diff) {
    const diffContainer = document.getElementById('diff-container');

    // 差分を HTML 形式に変換
    const htmlDiff = await window.electronAPI.getDiffHtml(diff);

    // 変更点を横に並べて表示
    diffContainer.innerHTML = htmlDiff;
}

window.electronAPI.on('selected-file', (filePath) => {
    window.electronAPI.readFile(filePath, (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        textEditor.value = data;
    });
});
window.electronAPI.on('selected-save-path', (savePath) => {
    saveFile(savePath);
});
window.electronAPI.on('selected-folder', (folderPath) => {
    // フォルダパスを表示
    folderPathSpan.textContent = folderPath;

    window.electronAPI.access(`${folderPath}/.git`, async (err) => {
        if (err) {
            // .gitフォルダが存在しない場合
            gitStatusSpan.innerHTML = '<span style="color: red;">&#11044;</span>';

            const gitInitConfirmed = confirm('This folder is not a git repository. Do you want to run "git init"?');
            if (gitInitConfirmed) {
                try {
                    const initResult = await window.electronAPI.execAsync(`git -C "${folderPath}" init`);
                    console.log(`Stdout: ${initResult}`);

                    gitStatusSpan.innerHTML = '<span style="color: blue;">&#11044;</span>';
                    window.electronAPI.initgitignore(folderPath);

                    const mainBranchResult = await window.electronAPI.execAsync(`git -C "${folderPath}" checkout -b main`);
                    console.log(`Stdout: ${mainBranchResult}`);

                    const commitResult = await commitChanges();
                    console.log(`Stdout: ${commitResult}`);

                    const updateBranchResult = await updateBranchList();
                    console.log(`Stdout: ${updateBranchList}`);

                    const commitListResult = await showCommitList();
                    console.log(`Stdout: ${commitListResult}`);
                } catch (error) {
                    console.error(`Error: ${error.message}`);
                    return;
                }
            }
        } else {
            // .gitフォルダが存在する場合
            gitStatusSpan.innerHTML = '<span style="color: blue;">&#11044;</span>';
        }
        updateBranchList(folderPath);
    });

});
window.electronAPI.on('created-new-branch', (newBranchName) => {
    const folderPath = folderPathSpan.textContent;
    window.electronAPI.exec(`git -C "${folderPath}" checkout -b "${newBranchName.trim()}"`, (error, stdout, stderr) => {
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