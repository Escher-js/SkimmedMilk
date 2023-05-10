const okBtn = document.getElementById('ok-btn');
const cancelBtn = document.getElementById('cancel-btn');
const branchNameInput = document.getElementById('branch-name');

console.log(window.ipc)

okBtn.addEventListener('click', () => {
    const newBranchName = branchNameInput.value;
    if (newBranchName.trim() === '') {
        alert('Branch name cannot be empty');
        return;
    }
    console.log(newBranchName)
    window.ipc.send('created-new-branch', newBranchName);

    window.close();
});

cancelBtn.addEventListener('click', () => {
    window.close();
});
