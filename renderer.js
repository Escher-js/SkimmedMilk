const fileBtn = document.getElementById('file-btn');
const saveBtn = document.getElementById('save-btn');
const gitInitBtn = document.getElementById('git-init-btn');
const textEditor = document.getElementById('text-editor');
const folderPathSpan = document.getElementById('folder-path');
const gitStatusSpan = document.getElementById('git-status');
const branchSelect = document.getElementById('branch-select');


saveBtn.addEventListener('click', () => {
    const folderPath = folderPathSpan.textContent;
    const timestamp = Date.now(); // Get current timestamp in seconds
    window.exec.do(`git -C "${folderPath}" tag marked=${timestamp}`)
    showCommitList()
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
    changeBranch(selectedBranch);
});
window.addEventListener('beforeunload', async (event) => {
    const folderPath = folderPathSpan.textContent;
    if (folderPath) {
        await commitChanges('Auto-commit on window close');
        await showCommitList();
    }
});
async function changeBranch(selectedBranch) {
    const folderPath = folderPathSpan.textContent;
    const changeBranchResult = await window.exec.do(`git -C "${folderPath}" checkout "${selectedBranch}"`)
    console.log(`Branch switched: ${changeBranchResult}`);
    await updateBranchList();
    await showCommitList();
}
async function updateBranchList() {
    const folderPath = folderPathSpan.textContent;
    const branchList = await window.exec.do(`git -C "${folderPath}" branch`);
    console.log(branchList);

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
    const folderPath = folderPathSpan.textContent;
    // git status を実行して変更を検出
    const gitStatus = await window.exec.do(`git -C "${folderPath}" status --porcelain`)

    // 変更がある場合のみコミット
    if (gitStatus.trim() !== '') {
        const commitResult = await window.exec.do(`git -C "${folderPath}" add . && git -C "${folderPath}" commit -m "${message}"`)
        console.log(`Commit successful: ${commitResult}`);
        return commitResult
    } else {
        console.log('No changes detected');
        return null;
    }
}
async function showCommitList() {
    const selectedBranch = branchSelect.options[branchSelect.selectedIndex].value;
    const folderPath = folderPathSpan.textContent;

    if (!folderPath || selectedBranch === 'create-new-branch') {
        console.log(`selected branch is ${selectedBranch}`);
        return;
    }

    const options = '--pretty=format:"%cd - %h - %s %d" --decorate=short'
    const commitLogOutput = await window.exec.do(`git -C "${folderPath}" log ${options} ${selectedBranch}`);
    console.log(`${commitLogOutput}`);
    const commitLines = commitLogOutput.split('\n');

    const commitListContainer = document.getElementById('commit-list');

    // Clear the commit list container and set it up as a table
    commitListContainer.innerHTML = '';
    commitListContainer.style.display = 'table';

    commitLines.forEach((commit) => {
        const tableRow = document.createElement('tr'); // Each commit will be a table row
        const [date, hash, rest] = commit.split(' - ');
        const dateObj = new Date(date);

        const dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
        const timeStr = dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        // Extract and format the message and tag information
        const messageMatch = rest.match(/(.*)(?=\s\()/);
        const message = messageMatch ? messageMatch[0] : rest;
        const tagMatch = rest.match(/\((.*?)\)/);
        const tags = tagMatch ? tagMatch[1].split(', ').filter(tag => tag.includes('tag: ')).join(', ') : "";
        const marked = tags.includes('marked');

        // If the commit is marked, add a small red circle to a separate cell
        const markerCell = document.createElement('td');
        if (marked) {
            markerCell.style.color = 'red';
            markerCell.textContent = '●';
        }
        tableRow.appendChild(markerCell);

        const commitCell = document.createElement('td');
        const textNode = document.createTextNode(`${hash} - ${dateStr}, ${timeStr}`);
        // const textNode = document.createTextNode(`${hash} - ${message} (${dateStr}, ${timeStr})`);
        commitCell.appendChild(textNode);
        tableRow.appendChild(commitCell);

        tableRow.addEventListener('click', () => {
            const commitHash = hash;
            showSelectedCommit(commitHash);
        });

        // Add event listener to show diff on mouseover
        tableRow.addEventListener('mouseover', async () => {
            const commitHash = hash;
            const diff = await getCommitDiff(commitHash);
            showDiff(diff);
        });

        commitListContainer.appendChild(tableRow);
    });
}
async function showSelectedCommit(commitHash) {
    const folderPath = folderPathSpan.textContent;
    console.log(folderPath)
    const parentPath = window.path.dirname(folderPath);
    const cloneFolderPath = window.path.join(parentPath, 'temp-clone');
    const branchName = `branch-${commitHash}`;  // 新しいブランチ名。適切な名前に変更してください。

    // クローンフォルダが存在する場合は更新
    if (window.fs.existsSync(cloneFolderPath)) {
        const fetchResult = await window.exec.do(`git -C "${cloneFolderPath}" fetch`)
        console.log(`Fetched updates for backup repository: ${fetchResult}`);
    } else {
        // クローンを作成
        const cloneResult = await window.exec.do(`git -C "${folderPath}" clone . "${cloneFolderPath}"`)
        console.log(`Cloned repository for backup: ${cloneResult}`);
    }

    // ブランチが存在するかどうか確認
    const checkoutbranch = await window.exec.do(`git -C "${folderPath}" branch --list ${branchName}`)
    const branchExists = (checkoutbranch.trim() === branchName);

    if (branchExists) {
        // ブランチが存在する場合はそのブランチにチェックアウト
        const checkoutResult = await window.exec.do(`git -C "${folderPath}" checkout "${branchName}"`)
        console.log(`Checked out existing branch: ${checkoutResult}`);
        await updateBranchList();
        await showCommitList();
    } else {
        // 新しいブランチを作成して選択したコミットまで戻す
        const checkoutResult = await window.exec.do(`git -C "${folderPath}" checkout -b "${branchName}" "${commitHash}"`)
        console.log(`Checked out commit on new branch: ${checkoutResult}`);
        await updateBranchList();
        await showCommitList();
    }
}

async function getCommitDiff(commitHash) {
    const folderPath = folderPathSpan.textContent;
    const commitHashListResult = await window.exec.do(`git -C "${folderPath}" show "${commitHash}" | head -n 100`)
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
    console.log(folderPath)

    window.fs.access(`${folderPath}/.git`, async (err) => {
        if (err) {
            // .gitフォルダが存在しない場合
            gitStatusSpan.innerHTML = '<span style="color: red;">&#11044;</span>';

            const gitInitConfirmed = confirm('This folder is not a git repository. Do you want to run "git init"?');
            if (gitInitConfirmed) {
                const initResult = await window.exec.do(`git -C "${folderPath}" init`);
                console.log(`gitinit: ${initResult}`);
                window.git.initignore(folderPath);
                const mainBranchResult = await window.exec.do(`git -C "${folderPath}" checkout -b main`);
                console.log(`checkedout to main: ${mainBranchResult}`);
                await commitChanges();
                gitStatusSpan.innerHTML = '<span style="color: blue;">&#11044;</span>';
            }
        } else {
            // .gitフォルダが存在する場合
            gitStatusSpan.innerHTML = '<span style="color: blue;">&#11044;</span>';
        }

        await updateBranchList(folderPath);
        console.log("-----commit log----")
        await showCommitList();
        console.log("-------------------")
    });
});
window.ipc.on('created-new-branch', (newBranchName) => {
    const folderPath = folderPathSpan.textContent;
    console.log("entered");
    const promise1 = window.exec.do(`git -C "${folderPath}" checkout -b "${newBranchName.trim()}"`)
    promise1.then(() => {
        updateBranchList(folderPath);
    })
});

setInterval(async () => {
    const commitResult = await commitChanges('Auto-updated')
    if (commitResult !== null) {
        showCommitList();
    }
}, 30 * 1000);