"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConvertProject = void 0;
const fs_1 = __importDefault(require("fs"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const projectTools_1 = __importDefault(require("./libs/projectTools"));
const fast_glob_1 = __importDefault(require("fast-glob"));
const rpgencrypt = __importStar(require("./libs/rpgencrypt"));
function setProgressBar(now, max = 100) {
    globalThis.mwindow.webContents.send('loading', (now / max) * 100);
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function createTempFolder() {
    const qTemp = path_1.default.join(electron_1.app.getPath('temp'), 'Extractorpp');
    if (!fs_1.default.existsSync(qTemp)) {
        fs_1.default.mkdirSync(qTemp);
    }
    const tempDir = path_1.default.join(qTemp, Date.now().toString(16));
    return tempDir;
}
function clearTemp() {
    return __awaiter(this, void 0, void 0, function* () {
        const qTemp = path_1.default.join(electron_1.app.getPath('temp'), 'Extractorpp');
        fs_extra_1.default.emptyDirSync(qTemp);
        console.log('temp clear');
    });
}
function ConvertProject(dir) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!fs_1.default.existsSync(dir)) {
                projectTools_1.default.sendError("????????? ???????????? ????????????");
                projectTools_1.default.worked();
                return;
            }
            const fd = yield electron_1.dialog.showOpenDialog(globalThis.mwindow, {
                title: "???????????? ?????? ?????? ??????",
                properties: ['openDirectory']
            });
            if (fd.canceled) {
                projectTools_1.default.worked();
                return;
            }
            dir = path_1.default.dirname(dir);
            const projectSaveDir = path_1.default.join(fd.filePaths[0], `Project${Math.floor(Date.now() / 1000).toString(16)}`);
            if (fs_1.default.existsSync(projectSaveDir)) {
                fs_extra_1.default.emptyDirSync(projectSaveDir);
            }
            else {
                fs_1.default.mkdirSync(projectSaveDir);
            }
            const commonDir = dir.replaceAll('\\', '/');
            let files = yield (0, fast_glob_1.default)(path_1.default.join(dir, '**', '*.*').replaceAll('\\', '/'));
            for (let i = 0; i < files.length; i++) {
                const f = files[i].substring(commonDir.length + 1);
                const targetdir = (path_1.default.join(projectSaveDir, f));
                if (!fs_1.default.existsSync(path_1.default.dirname(targetdir))) {
                    fs_extra_1.default.mkdirsSync(path_1.default.dirname(targetdir));
                }
                yield fs_extra_1.default.copyFile(files[i], targetdir);
                setProgressBar((i / files.length * 50));
            }
            // await fsa.copy(dir, projectSaveDir)
            // plugin.js
            const pluginjsPath = path_1.default.join(projectSaveDir, 'js', 'plugins.js');
            if (fs_1.default.existsSync(pluginjsPath)) {
                let pluginjs = fs_1.default.readFileSync(pluginjsPath, 'utf8');
                let hail0 = pluginjs.split('$plugins =');
                pluginjs = hail0[hail0.length - 1] + '  ';
                pluginjs = pluginjs.substring(pluginjs.indexOf('['), pluginjs.lastIndexOf(']') + 1);
                const plugins = (JSON.parse(pluginjs));
                let pluginDat = `// Generated by RPG Maker.\n`
                    + `// Do not edit this file directly.\n`
                    + `var $plugins =\n[`;
                for (const i in plugins) {
                    pluginDat += '\n' + JSON.stringify(plugins[i]) + ',';
                }
                pluginDat = pluginDat.substring(0, pluginDat.length - 1) + '\n];\n';
                fs_1.default.writeFileSync(pluginjsPath, pluginDat, 'utf8');
                console.log('pluginjs');
            }
            const sysJsonDir = path_1.default.join(projectSaveDir, 'data', 'System.json');
            if (fs_1.default.existsSync(sysJsonDir)) {
                let sysdata = JSON.parse(projectTools_1.default.rmBom(yield fs_extra_1.default.readFile(sysJsonDir, 'utf-8')));
                sysdata.hasEncryptedImages = false;
                sysdata.hasEncryptedAudio = false;
                fs_1.default.writeFileSync(sysJsonDir, JSON.stringify(sysdata));
                const EncryptedExtensions = [".rpgmvo", ".rpgmvm", ".rpgmvw", ".rpgmvp", ".ogg_", ".m4a_", ".wav_", ".png_"];
                let patterns = [];
                for (const i in EncryptedExtensions) {
                    patterns.push(path_1.default.join(projectSaveDir, '**', '*' + EncryptedExtensions[i]).replaceAll('\\', '/'));
                }
                const encryptedFiles = (yield (0, fast_glob_1.default)(patterns, { dot: true }));
                if (encryptedFiles.length > 0) {
                    const key = sysdata.encryptionKey;
                    for (const i in encryptedFiles) {
                        setProgressBar(50 + (parseInt(i) / encryptedFiles.length * 50));
                        rpgencrypt.Decrypt(encryptedFiles[i], path_1.default.dirname(encryptedFiles[i]), key);
                        fs_1.default.rmSync(encryptedFiles[i]);
                    }
                }
            }
            let isMz = false;
            let fileVersion = 'RPGMV 1.0.0';
            const rpgCoreDir = path_1.default.join(projectSaveDir, 'js', 'rpg_core.js');
            const mzCoreDir = path_1.default.join(projectSaveDir, 'js', 'rmmz_core.js');
            if (fs_1.default.existsSync(rpgCoreDir)) {
                const d = fs_1.default.readFileSync(rpgCoreDir, 'utf-8').split('\n');
                for (let i = 0; i < d.length; i++) {
                    if (d[i].includes('rpg_core.js')) {
                        let t = d[i].replaceAll(' ', '');
                        const t2 = t.split('v');
                        t = t2[t2.length - 1];
                        fileVersion = `RPGMV ${t}`;
                        break;
                    }
                }
                console.log('mv core');
            }
            if (fs_1.default.existsSync(mzCoreDir)) {
                isMz = true;
                const d = fs_1.default.readFileSync(mzCoreDir, 'utf-8').split('\n');
                for (let i = 0; i < d.length; i++) {
                    if (d[i].includes('rmmz_core.js')) {
                        let t = d[i].replaceAll(' ', '');
                        const t2 = t.split('v');
                        t = t2[t2.length - 1];
                        fileVersion = `RPGMZ ${t}`;
                        break;
                    }
                }
                console.log('mz core');
            }
            console.log(fileVersion);
            if (isMz) {
                fs_1.default.writeFileSync(path_1.default.join(projectSaveDir, 'game.rmmzproject'), fileVersion);
            }
            else {
                fs_1.default.writeFileSync(path_1.default.join(projectSaveDir, 'Game.rpgproject'), fileVersion);
            }
            setProgressBar(0);
            projectTools_1.default.sendAlert('?????????????????????');
            projectTools_1.default.worked();
            clearTemp();
        }
        catch (err) {
            globalThis.mwindow.webContents.send('alert', { icon: 'error', message: JSON.stringify(err, Object.getOwnPropertyNames(err)) });
        }
    });
}
exports.ConvertProject = ConvertProject;
