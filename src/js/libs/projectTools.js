"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function INIT() {
    pTools = {
        send: globalThis.mwindow.webContents.send,
        packed: pTools.packed,
        sendError: (txt) => {
            globalThis.mwindow.webContents.send('alert', { icon: 'error', message: txt });
        },
        sendAlert: (txt) => {
            globalThis.mwindow.webContents.send('alert', txt);
        },
        worked: () => {
            globalThis.mwindow.webContents.send('worked', 0);
            globalThis.mwindow.webContents.send('loading', 0);
        },
        rmBom: (txt) => {
            if (txt.charCodeAt(0) === 0xFEFF) {
                txt = txt.substring(1);
            }
            return txt;
        },
        init: () => { }
    };
}
function callBeforeInit() { console.error('Ptools called before init'); }
let pTools = {
    send: (channel, ...args) => { callBeforeInit(); },
    packed: ((require.main && require.main.filename.indexOf('app.asar') !== -1) || (process.argv.filter(a => a.indexOf('app.asar') !== -1).length > 0)),
    sendError: (txt) => { callBeforeInit(); },
    sendAlert: (txt) => { callBeforeInit(); },
    worked: () => { callBeforeInit(); },
    init: INIT,
    rmBom: (txt) => { callBeforeInit(); return (''); }
};
const Tools = {
    send: (channel, ...args) => { pTools.send(channel, ...args); },
    packed: pTools.packed,
    sendError: (txt) => { pTools.sendError(txt); },
    sendAlert: (txt) => { pTools.sendAlert(txt); },
    worked: () => { pTools.worked(); },
    init: INIT,
    rmBom: (txt) => { return pTools.rmBom(txt); }
};
exports.default = Tools;
