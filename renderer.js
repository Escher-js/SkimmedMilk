const fileBtn = document.getElementById('file-btn');
const saveBtn = document.getElementById('save-btn');
const gitInitBtn = document.getElementById('git-init-btn');
const textEditor = document.getElementById('text-editor');
const folderPathSpan = document.getElementById('folder-path');
const gitStatusSpan = document.getElementById('git-status');
const branchSelect = document.getElementById('branch-select');

let checkout = false;

saveBtn.addEventListener('click', async () => {
    await commitChanges('you saved')
    await showCommitList();
});
gitInitBtn.addEventListener('click', () => {
    window.ipc.send('open-folder-dialog');
});
branchSelect.addEventListener('change', async () => {
    const selectedBranch = branchSelect.options[branchSelect.selectedIndex].value;
    const folderPath = folderPathSpan.textContent;

    if (selectedBranch === 'create-new-branch') {
        // show-branch-input-dialogを待機するPromiseを定義
        const waitForBranchInputDialog = async () => {
            return new Promise((resolve) => {
                window.ipc.once('branch-input-dialog-closed', () => {
                    resolve();
                });
            });
        };
        window.ipc.once('branch-input-dialog-closed');
        // ダイアログが閉じるのを待つ
        await window.ipc.invoke('show-branch-input-dialog');
        await waitForBranchInputDialog();
    }

    // 選択されたブランチにチェックアウト
    const changeBranchResult = await window.exec.async(`git -C "${folderPath}" checkout "${selectedBranch}"`)
    console.log(`Branch switched: ${changeBranchResult}`);
    await updateBranchList();
    await showCommitList();
});
window.addEventListener('beforeunload', async (event) => {
    const folderPath = folderPathSpan.textContent;
    if (folderPath) {
        await commitChanges('Auto-commit on window close');
        await showCommitList();
    }
});
async function updateBranchList() {
    const folderPath = folderPathSpan.textContent;
    const branchList = await window.exec.async(`git -C "${folderPath}" branch`);

    const branches = branchList.split('\n').filter(line => line.trim() !== '').map(branch => branch.trim());
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
async function commitChanges(message) {
    if (!checkout) {
        checkout = true;
        const folderPath = folderPathSpan.textContent;
        console.log(`folderPath: ${folderPath}`)
        // git status を実行して変更を検出
        const gitStatus = await window.exec.async(`git -C "${folderPath}" status --porcelain`)
        console.log(gitStatus)

        // 変更がある場合のみコミット
        if (gitStatus.trim() !== '') {
            const commitMessage = `${message} on ${new Date().toLocaleString()}`;
            const commitResult = await window.exec.async(`git -C "${folderPath}" add . && git -C "${folderPath}" commit -m "${commitMessage}"`)
            checkout = false
            console.log(`Commit successful: ${commitResult}`);
        } else {
            console.log('No changes detected');
        }
    } else {
        console.log("git is now busy.");
    }
}
async function showCommitList() {
    // コミットリストを取得
    const commitLines = await getCommitList();
    console.log(`commitLines:${commitLines}`);
    // コミットリストを表示
    const commitListContainer = document.getElementById('commit-list');
    commitListContainer.innerHTML = '';

    commitLines.forEach((commit) => {
        const listItem = document.createElement('li');
        listItem.textContent = commit;
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
        console.log('selected branch is "create new branch"');
        return;
    }

    const commitLogOutput = await window.exec.async(`git -C "${folderPath}" log --pretty=format:"%h - %s" ${selectedBranch}`)
    console.log(`commitLogOutput:${commitLogOutput}`)
    return commitLogOutput.split('\n');
}
async function showSelectedCommit(commitHash) {
    const folderPath = folderPathSpan.textContent;
    const parentPath = window.path.dirname(folderPath);
    const cloneFolderPath = window.path.join(parentPath, 'temp-clone');

    // クローンフォルダが存在する場合は削除
    if (window.fs.existsSync(cloneFolderPath)) {
        await window.fs.rm(cloneFolderPath, { recursive: true, force: true });
    }
    // クローンを作成
    const cloneResult = await window.exec.async(`git -C "${folderPath}" clone . "${cloneFolderPath}"`)
    console.log(`Cloned repository: ${cloneResult}`);
    // 選択したコミットまで戻す
    const commitResetResult = await window.exec.async(`git -C "${cloneFolderPath}" checkout "${commitHash}"`)
    console.log(`Checked out commit: ${commitResetResult}`);
}
async function getCommitDiff(commitHash) {
    const folderPath = folderPathSpan.textContent;
    const commitHashListResult = await window.exec.async(`git -C "${folderPath}" show "${commitHash}" | head -n 100`)
    console.log(commitHashListResult)
    return commitHashListResult;
}
async function showDiff(diff) {
    const diffContainer = document.getElementById('diff-container');

    // 差分を HTML 形式に変換
    const htmlDiff = await window.electronAPI.getDiffHtml(diff);

    // 変更点を横に並べて表示
    diffContainer.innerHTML = htmlDiff;
}

window.ipc.on('selected-folder', (folderPath) => {
    // フォルダパスを表示
    folderPathSpan.textContent = folderPath;

    window.fs.access(`${folderPath}/.git`, async (err) => {
        if (err) {
            // .gitフォルダが存在しない場合
            gitStatusSpan.innerHTML = '<span style="color: red;">&#11044;</span>';

            const gitInitConfirmed = confirm('This folder is not a git repository. Do you want to run "git init"?');
            if (gitInitConfirmed) {
                const initResult = await window.exec.async(`git -C "${folderPath}" init`);
                console.log(`gitinit: ${initResult}`);
                gitStatusSpan.innerHTML = '<span style="color: blue;">&#11044;</span>';
                window.git.initignore(folderPath);
                const mainBranchResult = await window.exec.async(`git -C "${folderPath}" checkout -b main`);
                console.log(`checkedout to main: ${mainBranchResult}`);
                console.log("1")
                await commitChanges();
            }
        } else {
            // .gitフォルダが存在する場合
            gitStatusSpan.innerHTML = '<span style="color: blue;">&#11044;</span>';
        }
        console.log("2")
        await updateBranchList(folderPath);
        console.log("3")
        await showCommitList();
    });
});
window.ipc.on('created-new-branch', (newBranchName) => {
    const folderPath = folderPathSpan.textContent;
    console.log("entered");
    const promise1 = window.exec.async(`git -C "${folderPath}" checkout -b "${newBranchName.trim()}"`)
    promise1.then(() => {
        updateBranchList(folderPath);
    })
});

setInterval(async () => {
    await commitChanges('Auto-updated')
    await showCommitList();
}, 60 * 1000);