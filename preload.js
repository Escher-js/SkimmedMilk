const { contextBridge, ipcRenderer } = require('electron');
const Diff2html = require('diff2html');
const fs = require('fs');
const { exec } = require('child_process');
const gitignoreDefaults = require('./gitignore_defaults');
const path = require('path');
const os = require('os');
const ignore = require('ignore');

async function scanFolderRecursive(folderPath, ig) {
    let filesToTrack = [];
    const files = fs.readdirSync(folderPath);

    for (const file of files) {
        const absolutePath = path.join(folderPath, file);
        if (ig.ignores(file)) {
            continue;
        }
        const fileStat = fs.statSync(absolutePath);

        if (fileStat.isDirectory()) {
            const innerFiles = await scanFolderRecursive(absolutePath, ig);
            filesToTrack = filesToTrack.concat(innerFiles);
        } else {
            const fileSizeInBytes = fileStat.size;
            const fileSizeInMegabytes = fileSizeInBytes / (1024 * 1024);
            if (fileSizeInMegabytes > 1000) {
                filesToTrack.push(absolutePath);
            }
        }
    }
    return filesToTrack;
}
async function scanFolder(folderPath) {
    const ignorePath = path.join(folderPath, '.gitignore');
    console.log("ig:", ignorePath)
    const gitignoreContent = fs.readFileSync(ignorePath).toString();
    console.log("igContents:", gitignoreContent)
    const ig = ignore().add(gitignoreContent);
    console.log("ig:", ig)
    return scanFolderRecursive(folderPath, ig)
}

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
    scanFolder: scanFolder

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
    relative: (paths) => {
        return path.relative(paths)
    }
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
    statSync: (filePath) => {
        return fs.statSync(filePath);
    },
    readdirSync: (path) => {
        return fs.readdirSync(path)
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
    initignore: async (folderPath) => {
        return new Promise((resolve, reject) => {
            fs.writeFile(`${folderPath}/.gitignore`, gitignoreDefaults.defaultGitignoreContent, (error) => {
                if (error) {
                    console.error(`Error: ${error.message}`)
                    reject(error)
                } else {
                    console.log('Created .gitignore file')
                    resolve()
                }
            })
        })
    },
    appendToGitignore: async (folderPath, absolutefilePaths) => {
        return new Promise((resolve, reject) => {
            const relative = path.relative(folderPath, absolutefilePaths)
            fs.appendFile(`${folderPath}/.gitignore`, `\n${relative}`, (error) => {
                if (error) {
                    console.error(`Error: ${error.message}`)
                    reject(error)
                } else {
                    console.log('Appended to .gitignore file')
                    resolve()
                }
            })
        })
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