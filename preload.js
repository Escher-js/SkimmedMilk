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
});
