const { contextBridge, ipcRenderer } = require('electron');
const Diff2html = require('diff2html');
const fs = require('fs');
const { exec } = require('child_process');
const gitignoreDefaults = require('./gitignore_defaults');
const path = require('path');


contextBridge.exposeInMainWorld('electronAPI', {
    /* conctextBridge (ipcrenderer) */
    on: (channel, callback) => {
        return ipcRenderer.on(channel, (_, ...args) => callback(...args));
    },
    once: (channel, callback) => {
        return ipcRenderer.once(channel, (_, ...args) => callback(...args));
    },
    removeListener: (channel, callback) => {
        ipcRenderer.removeListener(channel, (_, ...args) => callback(...args));
    },
    send: (channel, ...args) => {
        return ipcRenderer.send(channel, ...args);
    },
    invoke: (channel, ...args) => {
        return ipcRenderer.invoke(channel, ...args);
    },

    /* fs */
    access: (path, callback) => {
        fs.access(path, fs.constants.F_OK, callback);
    },
    writeFile: (path, data, callback = null) => {
        if (callback) {
            fs.writeFile(path, data, callback);
        } else {
            fs.writeFile(path, data, (error) => {
                if (error) {
                    console.error(`Error: ${error.message}`);
                }
            });
        }
    },
    readFile: (path, options, callback = null) => {
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
        readFile: (path, options, callback) => {
            fs.readFile(path, options, (error, data) => {
                callback(error, data);
            });
        },
        rm: (path, options) => fs.promises.rm(path, options),
    },

    /* exec */
    exec: (command, callback) => {
        exec(command, callback);
    },

    /* path */
    joinPath: (...paths) => {
        return path.join(...paths);
    },

    /* external library */
    getDiffHtml: (diff) => {
        const diffJson = Diff2html.parse(diff);
        const diffHtml = Diff2html.html(diffJson, { drawFileList: true });
        return diffHtml
    },
    getGitignoreDefaults: () => gitignoreDefaults,
});
