const { contextBridge, ipcRenderer } = require('electron');
const { Diff2Html } = require('diff2html');
const fs = require('fs');
const { exec } = require('child_process');
const gitignoreDefaults = require('./gitignore_defaults');
const path = require('path');

console.log(Diff2Html)

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
    getDiff2HtmlVersion: getDiff2HtmlVersion,

    getDiffHtml: async (diff) => {
        return await new Promise((resolve) => {
            console.log('Diff2Html:', Diff2Html);

            const result = getPrettyHtml(diff, {
                inputFormat: 'diff',
                showFiles: false,
                matching: 'lines',
                outputFormat: 'side-by-side',
            });
            resolve(result);
        });
    },
    getGitignoreDefaults: () => gitignoreDefaults,
});

function getDiff2HtmlVersion() {
    const diff2HtmlPackagePath = path.dirname(require.resolve('diff2html'));
    const packageJsonPath = path.join(diff2HtmlPackagePath, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version;
}
