const { ipcRenderer } = require('electron');

const fileBtn = document.getElementById('file-btn');

fileBtn.addEventListener('click', () => {
    ipcRenderer.send('open-file-dialog');
});
