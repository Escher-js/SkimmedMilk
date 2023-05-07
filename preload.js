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
    access: (path, callback) => {
        fs.access(path, fs.constants.F_OK, callback);
    },

    writeFile: (path, data, callback) => {
        fs.writeFile(path, data, callback);
    },

    readFile: (path, options, callback) => {
        fs.readFile(path, options, callback);
    },

    readFileSync: (path, options) => {
        return fs.readFileSync(path, options);
    },

    writeFileSync: (path, data, options) => {
        fs.writeFileSync(path, data, options);
    },

    existsSync: (path) => {
        return fs.existsSync(path);
    },

    promises: {
        readFile: (path, options) => fs.promises.readFile(path, options),
        rm: (path, options) => fs.promises.rm(path, options),
    },
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
