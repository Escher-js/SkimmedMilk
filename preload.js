const { contextBridge, ipcRenderer } = require('electron');
const Diff2html = require('diff2html');
const fs = require('fs');
const { exec } = require('child_process');
const gitignoreDefaults = require('./gitignore_defaults');
const path = require('path');
const os = require('os');

contextBridge.exposeInMainWorld('electronAPI', {
    /* external library */
    getDiffHtml: (diff) => {
        const diffJson = Diff2html.parse(diff);
        const diffHtml = Diff2html.html(diffJson, { drawFileList: true });
        return diffHtml
    },
    tmpdir: () => {
        return os.tmpdir();
    },
});
contextBridge.exposeInMainWorld('exec', {
    do: (command) => {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error && error.code !== 0) {
                    console.error(`Error: ${error.message}`);
                    reject(error);
                    return;
                }
                if (stderr) {
                    resolve(`Stderr: ${stderr}`);
                }
                resolve(stdout);
            });
        });
    },
    out: (command, outputPath) => {
        return new Promise((resolve, reject) => {
            exec(`${command} > "${outputPath}"`, (error, stdout, stderr) => {
                if (error && error.code !== 0) {
                    console.error(`Error: ${error.message}`);
                    reject(error);
                    return;
                }
                if (stderr) {
                    console.error(`Stderr: ${stderr}`);
                }
                fs.readFile(outputPath, 'utf8', (err, data) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(data);
                });
            });
        });
    },
});
contextBridge.exposeInMainWorld('path', {
    join: (...paths) => {
        return path.join(...paths);
    },
    dirname: (paths) => {
        console.log(path)
        return path.dirname(paths);
    },
});
contextBridge.exposeInMainWorld('ipc', {

    send: (channel, ...args) => {
        return ipcRenderer.send(channel, ...args);
    },
    invoke: (channel, ...args) => {
        return ipcRenderer.invoke(channel, ...args);
    },
    on: (channel, callback) => {
        return ipcRenderer.on(channel, (_, ...args) => callback(...args));
    },
    once: (channel, callback) => {
        return ipcRenderer.once(channel, (_, ...args) => callback(...args));
    },
});
const anyShellEscape = require('any-shell-escape');

contextBridge.exposeInMainWorld('shellEscape', {
    escape: (filePath) => {
        return anyShellEscape([filePath]);
    }
});

contextBridge.exposeInMainWorld('fs', {
    access: (path, callback) => { fs.access(path, fs.constants.F_OK, callback); },
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
    statSyncSize: (filePath) => {
        return fs.statSync(filePath).size;
    },
    readFile: (path, options, callback = null) => { fs.readFile(path, options, callback); },
    existsSync: (path) => { return fs.existsSync(path); },
    rm: (path, options) => fs.promises.rm(path, options),
    promises: {
        readFile: (path, options, callback) => {
            fs.readFile(path, options, (error, data) => {
                callback(error, data);
            });
        },
    },
});
contextBridge.exposeInMainWorld('git', {
    initignore: (folderPath) => {
        fs.writeFile(`${folderPath}/.gitignore`, gitignoreDefaults.defaultGitignoreContent, (error) => {
            if (error) {
                console.error(`Error: ${error.message}`);
                return;
            }
            console.log('Created .gitignore file');
        });
    },
    setConfig: async (username, email) => {
        return await ipcRenderer.invoke('set-git-config', username, email);
    },
});
contextBridge.exposeInMainWorld('electron', {
    setGitConfig: async (username, email) => {
        return await ipcRenderer.invoke('set-git-config', username, email);
    },
});