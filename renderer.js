const { ipcRenderer } = require('electron');
const fs = require('fs');
const { exec } = require('child_process');

const fileBtn = document.getElementById('file-btn');
const saveBtn = document.getElementById('save-btn');
const gitInitBtn = document.getElementById('git-init-btn');
const textEditor = document.getElementById('text-editor');

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

gitInitBtn.addEventListener('click', () => {
    ipcRenderer.send('open-folder-dialog');
});

ipcRenderer.on('selected-folder', (event, folderPath) => {
    exec(`git init "${folderPath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`Stderr: ${stderr}`);
            return;
        }
        console.log(`Stdout: ${stdout}`);
    });
});