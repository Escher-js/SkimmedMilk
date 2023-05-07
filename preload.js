const { contextBridge, ipcRenderer } = require('electron');
const { Diff2Html } = require('diff2html');
const fs = require('fs');
const { exec } = require('child_process');
const gitignoreDefaults = require('./gitignore_defaults');


contextBridge.exposeInMainWorld('electronAPI', {
    getDiffHtml: (diff) => {
        return Diff2Html.getPrettyHtml(diff, {
            inputFormat: 'diff',
            showFiles: false,
            matching: 'lines',
            outputFormat: 'side-by-side',
        });
    },
    // fs, child_process, gitignoreDefaults を使用するメソッドを追加
    readFile: (path) => fs.readFileSync(path, 'utf-8'),
    writeFile: (path, data) => fs.writeFileSync(path, data),
    exec: (command, options) => {
        return new Promise((resolve, reject) => {
            exec(command, options, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve({ stdout, stderr });
            });
        });
    },
    getGitignoreDefaults: () => gitignoreDefaults,
});
