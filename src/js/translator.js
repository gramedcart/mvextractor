const path = require('path')
const fs = require('fs');
const PU = require('tcp-port-used');
const spawn = require('child_process').spawn;
const dataBaseO = require('./datas.js')
const {checkIsMapFile, sleep} = require('./globalutils.js')
const axios = require('axios')
const {translateable, note2able, translateableOne, hanguls} = require('./datas.js')
const edTool = require('./edtool')
const { performance } = require('perf_hooks');
const open = require('open');
const translatte = require("translatte")

function oPath(){
    return globalThis.oPath
}

function applyUserDict(input){
    const Udict = globalThis.settings.userdict
  
    for(let i=0;i<Object.keys(Udict).length;i++){
      const akey = Object.keys(Udict)[i]
      input = input.replaceAll(akey,Udict[akey])
    }
    return input
}

function encodeURIp(p) {
    p = p.replaceAll('■', '■0')
    p = p.replaceAll('%', '■1')
    p = p.replaceAll('％', '■2')
    p = p.replaceAll('|', '■3')
    return p
}

function decodeURIp(p, encodeSp=false) {
    p = p.replaceAll('■1', '%')
    p = p.replaceAll('■0', '■')
    p = p.replaceAll('■2', '％')
    p = p.replaceAll('■3', '|')
    if(encodeSp){
        p = p.replaceAll(' ', ' ')
    }
    return p
}

function encodeSp(p, change=false){
    if(change){
        p = p.replaceAll(' ', ' ')
    }
    return p
}


const fndi = /\\ *V *\[/g

class Translator{
    constructor(type, type2='', langu='jp'){
        this.type = type
        this.type2 = type2
        this.ls = null
        this.transMemory = {}
        this.langu = langu
    }
    setLs(ls){
        this.ls = ls
    }
    KillLs(ls){
        try {
            this.ls.kill()
        } catch (error) {}
    }
    async translate(text){
        let isEndPadding = 0
        while(text.at(text.length - 1) === '\n'){
            text = text.substring(0, text.length - 1)
            isEndPadding += 1
        }
        text = await this.translate2(text)
        while(isEndPadding > 0){
            text += '\n'
            isEndPadding -= 1
        }
        return text
    }
    async translate2(text){
        if(globalThis.settings.DoNotTransHangul){
            if(hanguls.test(text)){
                return text
            }
        }
        text = applyUserDict(text)
        if(this.type === 'eztrans'){
            let t
            // console.log(text)
            try {
                const a =  await axios.get(
                    'http://localhost:8000/',
                    {
                        params: {
                            text: text
                        },
                        timeout: 10000
                    }
                )
                t = a.data
            } catch (error) {
                try {
                    try {
                        this.KillLs()
                    } catch (error) {}
                    this.ls = spawn(path.join(oPath(), 'exfiles', 'eztrans' ,'eztransServer.exe'));
                    console.log('spawned')
                    await sleep(2000)
                    await PU.waitUntilUsed(8000)
                } catch (error) {
                    console.log('spawn failed')
                }
                t = a
            }
            if(typeof(t) !== 'string' && typeof(t) !== 'number'){
                return `ERROR: RETURNED ${JSON.stringify(t)}`
            }
            return (t)
        }
        else if(this.type === 'transEngine'){
            function encodeSafe(text, sup=false){
                if(sup){
                    console.log('encodeSafe')
                    text.replaceAll('◆','◇').replaceAll('\n','◆')
                }
                return text
            }
            function decodeSafe(text, sup=false){
                if(sup){
                    console.log('decodeSafe')
                    text.replaceAll('◆','\n')
                }
                text.replaceAll(fndi,'\\V[')
                return text
            }
            let t
            // console.log(text)
            try {
                if(text.length < 1){
                    console.log("zero len")
                    t = text
                }
                else if(Object.keys(this.transMemory).includes(text)){
                    console.log('from memory')
                    t = this.transMemory[text]
                }
                else{
                    const tempTxt = encodeSafe(text, this.type2 === 'papago')
                    console.log('requesting')
                    if(this.type2 === 'google'){
                        const a = await translatte(tempTxt, {from: this.langu, to: 'ko'})
                        await sleep(1000)
                        return decodeSafe(a.text)
                    }
                    else{
                        console.log(tempTxt)
                        const a = (await axios.get(
                            'http://localhost:8000/',
                            {
                                params: {
                                    text: tempTxt,
                                    platform: this.type2,
                                    source: this.langu,
                                    target: 'ko'
                                },
                                timeout: 10000
                            }
                        ))
                        try {
                            console.log(a.data.data.translatedContent)
                            t = a.data.data.translatedContent
                            t = decodeSafe(t, this.type2 === 'papago')
                            this.transMemory[text] = t
                        } catch (error) {
                            console.log('err: notranslatedContent')
                            t = text
                        }
                    }
                }
            } catch (error) {
                try {
                    try {
                        this.KillLs()
                    } catch (error) {}
                    this.ls = spawn(path.join(oPath(), 'exfiles', 'transEngine' ,'translate_engine.exe'));
                    console.log('spawned')
                    await sleep(2000)
                    await PU.waitUntilUsed(8000)
                } catch (error) {
                    console.log('spawn failed')
                }
                t = a
            }
            if(typeof(t) !== 'string' && typeof(t) !== 'number'){
                return `ERROR: RETURNED ${JSON.stringify(t)}`
            }
            return (t)
        }
    }
    getType(){
        return this.type
    }
    async isCrash(){
        if(this.type === 'eztrans'){
            if (!(await PU.check(8000))) {
                console.log('err')
                globalThis.mwindow.webContents.send('alert', {
                    icon: 'error',
                    message: 'Eztrans 서버와 연결할 수 없습니다.'
                });
                globalThis.mwindow.webContents.send('worked', 0);
                return true
            }
        }
        return false
    }
}

function setProgressBar(now, max){
    console.log(`${now} / ${max}`)
    globalThis.mwindow.webContents.send('loading', (now/max) * 70);
}

exports.trans = async (ev, arg) => {
    const dm = true
    globalThis.settings.safeTrans = true
    globalThis.settings.smartTrans = true;
    globalThis.settings.fastEztrans = true;

    let compatibilityMode = false
    let type2 = ''
    const langu = arg.langu
    if(arg.type == 'eztransh'){
        globalThis.settings.smartTrans = false;
        compatibilityMode = true
        arg.type = 'eztrans'
    }
    if(arg.type == 'papago'){
        globalThis.settings.smartTrans = false;
        arg.type = 'transEngine'
        type2 = 'papago'
    }
    if(arg.type == 'google'){
        globalThis.settings.smartTrans = false;
        arg.type = 'transEngine'
        type2 = 'google'
    }
    const translator = new Translator(arg.type, type2, langu)
    let ls


    try {
        const dir = Buffer.from(arg.dir, "base64").toString('utf8');
        const edir = path.join(dir, 'Extract')
        if (!fs.existsSync(edir)) {
            globalThis.mwindow.webContents.send('alert', {
                icon: 'error',
                message: 'Extract 폴더가 존재하지 않습니다'
            });
            globalThis.mwindow.webContents.send('worked', 0);
            return
        }
        let isUsed
        const fileList = fs.readdirSync(edir)
        const max_files = fileList.length
        let fullFileLength = 0
        let workedFileLength = 0
        console.log(translator.getType())
        for(const i in fileList){
            const iPath = path.join(edir, fileList[i])
            fullFileLength += fs.readFileSync(iPath, 'utf-8').length
        }
        console.log(fullFileLength)
        if(translator.getType() == 'transEngine'){
            console.log('transEngine')
            await PU.check(8000).then(function (inUse) {
                isUsed = inUse
            })
            if (isUsed) {
                globalThis.mwindow.webContents.send('alert', {
                    icon: 'error',
                    message: '포트 8000이 사용중입니다.'
                });
                globalThis.mwindow.webContents.send('worked', 0);
                return
            }
            ls = spawn(path.join(oPath(), 'exfiles', 'transEngine' ,'translate_engine.exe'));
            translator.setLs(ls)

            await sleep(1000)
            try {
                await PU.waitUntilUsed(8000)
            } catch (error) {
                globalThis.mwindow.webContents.send('alert', {
                    icon: 'error',
                    message: '구동 도중 오류가 발생하였습니다'
                });
                try {
                    translator.KillLs()
                } catch (error) {   }
                globalThis.mwindow.webContents.send('worked', 0);
                return
            }
            await sleep(1000)
        }
        if(translator.getType() == 'eztrans'){
            console.log('eztrans')
            await PU.check(8000).then(function (inUse) {
                isUsed = inUse
            })
            if (isUsed) {
                globalThis.mwindow.webContents.send('alert', {
                    icon: 'error',
                    message: '포트 8000이 사용중입니다.'
                });
                globalThis.mwindow.webContents.send('worked', 0);
                return
            }
            ls = spawn(path.join(oPath(), 'exfiles', 'eztrans' ,'eztransServer.exe'));
            translator.setLs(ls)
            // ls.stdout.on('data', function (data) {
            //     console.log("eztrans");
            //     console.log('data' + data);
            // });
            
            ls.stderr.on('data', function (data) {
                console.log("eztrans - Error");
                console.log('test: ' + data);
            });
            
            ls.on('close', function (code) {
                console.log("eztrans");
                console.log("close");
            });
            
            await sleep(3000)
            try {
                await PU.waitUntilUsed(8000)
            } catch (error) {
                globalThis.mwindow.webContents.send('eztransError');
                setTimeout(() => {open(`https://dotnet.microsoft.com/en-us/download/dotnet/thank-you/runtime-desktop-6.0.1-windows-x86-installer`)}, 2000)
                try {
                    translator.KillLs()
                } catch (error) {   }
                globalThis.mwindow.webContents.send('worked', 0);
                return
            }
            await sleep(1000)
        }
        let worked_files = 0
        const edDat = edTool.read(dir)
        let eed = {}
        console.log(Object.keys(edDat.main))
        for (const i in fileList) {
            let typeOfFile = ''
            if (globalThis.settings.safeTrans || globalThis.settings.smartTrans) {
                const name = fileList[i]
                console.log(name)
                if(compatibilityMode){
                    const NoneCompList = [
                        'System.txt'
                    ]
                    if(NoneCompList.includes(name)){
                        console.log('skipping by compatibilityMode')
                        continue
                    }
                }
                if (name.includes('ext_scripts.txt')) {
                    typeOfFile = 'src'
                    console.log('src')
                    if(!globalThis.settings.smartTrans ||compatibilityMode){
                        continue
                    }
                } else if (name.includes('ext_note.txt')) {
                    typeOfFile = 'note'
                    if(!globalThis.settings.smartTrans || compatibilityMode){
                        console.log('skiping note')
                        continue
                    }
                } else if (name.includes('ext_note2.txt')) {
                    typeOfFile = 'note2'
                    if(!globalThis.settings.smartTrans || compatibilityMode){
                        console.log('skiping note2')
                        continue
                    }
                    else{
                        let eed2 = edDat.main['ext_note2.json'].data
                        for(const i2 in eed2){
                            const cdat = eed2[i2]
                            eed[i2] = cdat.conf.code
                        }
                    }
                } else if ((!(dataBaseO.default.includes(name))) && (!checkIsMapFile(name))) {
                    console.log('skiping')
                    continue
                }
                else if(name == 'ext_plugins.txt'){
                    if(globalThis.settings.safeTrans || compatibilityMode){
                        console.log('skiping ' + name)
                        continue
                    }
                }
            }
            const iPath = path.join(edir, fileList[i])
            const fileRead = (fs.readFileSync(iPath, 'utf-8'))
            let output = ''
            let transIt = false
            let folkt = false
            let typeofit = 0


            if(typeOfFile == '' && globalThis.settings.fastEztrans){
                const readLen = (translator.getType() === 'eztrans') ? 1000
                                : (translator.type2 === 'google') ? 1000
                                : 220
                let reads = fileRead.split('\n')
                let a = ''
                let l = 0
                let chunks = []
                let debuging = false
                if(fileList[i] === 'Map004.txt'){
                    debuging = true
                }
                while(reads.length > 0){
                    const d = reads[0]
                    if(l + d.length > readLen){
                        l = 0
                        chunks.push(encodeURIp(a))
                        a = ''
                    }
                    l += d.length
                    a += d + '\n'
                    reads.shift()
                }
                

                chunks.push(encodeURIp(a))
                for(const v in chunks){
                    let ouput = ''
                    let temps = ''
                    try {
                        temps = await translator.translate(chunks[v])
                    } catch (error) {
                        console.log('err-crash')
                        if (await translator.isCrash()) {
                            return
                        }
                        temps = chunks[v]
                    }
                    const chunkLen = chunks[v].split('\n').length
                    const tempLen = temps.split('\n').length
                    const isLine = (chunkLen !== tempLen)
                    if(temps == chunks[v] || isLine){
                        console.log(`err-line ${chunkLen} | ${tempLen}`)
                        const r = chunks[v].split('\n')
                        let r2 = []
                        for (const a in r) {
                            const readLine = r[a]
                            try {
                                const tr = await translator.translate((readLine))
                                r2.push(tr)
                            } catch (error) {
                                console.log(readLine)
                                if (await translator.isCrash()) {
                                    return
                                }
                                r2.push(readLine)
                            }
                        }
                        ouput = r2.join('\n')
                    }
                    else{
                        ouput = temps
                    }
                    output += encodeSp(decodeURIp(ouput))
                    setProgressBar(workedFileLength + output.length, fullFileLength)
                }
            }
            else{
                const read = fileRead.split('\n')
                for (const v in read) {
                    try {
                        setProgressBar(workedFileLength + output.length, fullFileLength)
                        const readLine = read[v];
                        switch (typeOfFile){
                            case '':
                                const ouput = await translator.translate((readLine))
                                const d = encodeSp(ouput) + '\n'
                                output += d
                                break
                            case 'src':
                                if(readLine.startsWith('D_TEXT ')){
                                    let rl = readLine.split(' ')
                                    if(rl.length > 3){
                                        while(rl.length > 3){
                                            rl[1] = rl[1]+' '+rl[2]
                                            rl.splice(2)
                                        }
                                    }
                                    if(rl.length == 3 && isNaN(rl[2])){
                                        console.log(rl.join(' '))
                                        rl[1] = rl[1]+' '+rl[2]
                                        rl.splice(2)
                                    }
                                    const ouput = await translator.translate((rl[1]))
                                    rl[1] = encodeSp(ouput, true)
                                    output += rl.join(' ') + '\n'
                                }
                                else{
                                    output += readLine + '\n'
                                }
                                break
                            case 'note':
                                let fi = ''
                                let rl = readLine
                                if(!transIt){
                                    let startAble = false
                                    for(const vv in translateable){
                                        if (readLine.replaceAll(' ','').startsWith(translateable[vv])){
                                            startAble = true
                                            fi = translateable[vv]
                                            folkt = translateableOne.includes(fi)
                                            console.log(`${fi} | ${folkt}`)
                                            break
                                        }
                                    }
                                    if(startAble){
                                        transIt = true
                                        rl = rl.substring(fi.length, rl.length)
                                    }
                                    else{
                                        output += rl + '\n'
                                        break
                                    }
                                }
                                if(transIt){
                                    if(rl.includes('>') || (folkt && rl.includes(' '))){
                                        transIt = false
                                        let keyString = '>'
                                        if((folkt && rl.includes(' '))){
                                            keyString = ' '
                                        }
                                        let vax = '>\n'
                                        vax = rl.substring(rl.indexOf(keyString)) + '\n'
    
                                        
                                        rl = rl.substring(0, rl.indexOf(keyString))
                                        const ouput = await translator.translate((rl))
                                        try{
                                            output += fi + encodeSp(ouput, true) + vax
                                        }
                                        catch{
                                            output += fi + rl + vax
                                            if (await translator.isCrash()){
                                                return
                                            }
                                        }
                                    }
                                    else{
                                        const ouput = await translator.translate((rl))
                                        try{
                                            output += fi + encodeSp(ouput, true) + '\n'
                                        }
                                        catch{
                                            output += fi + rl + '\n'
                                            if (await translator.isCrash()){
                                                return
                                            }
                                        }
                                    }
                                }
                                else{
                                    output += rl + '\n'
                                }
                                break
                            case 'note2':
                                if(transIt){
                                    if(eed[v] == 408){
                                        let run = true
                                        if(readLine.startsWith('\\>')){
                                            typeofit = 1
                                        }
                                        else if(typeofit == 1){
                                            run = false
                                            transIt = false
                                        }
                                        if(run){
                                            const ouput = await translator.translate((readLine))
                                            try{
                                                output += encodeSp(ouput, true) + '\n'
                                            }
                                            catch{
                                                output += readLine + '\n'
                                                if (await translator.isCrash()){
                                                    return
                                                }
                                            }
                                        }
                                    }
                                    else{
                                        transIt = false
                                    }
                                }
                                if(!transIt){
                                    if(note2able.includes(readLine) && eed[v] == 108){
                                        transIt = true
                                        typeofit = 0
                                    }
                                    output += readLine + '\n'
                                }
                                break
                        }
                    } catch (error) {
                        console.log(read[v])
                        console.log('err')
                        if (await translator.isCrash()) {
                            return
                        }
                        output += read[v] + '\n'
                    }
                }
            }
            worked_files += 1
            workedFileLength += output.length
            fs.writeFileSync(iPath, output, 'utf-8')
            // globalThis.mwindow.webContents.send('loading', worked_files / max_files * 100);
            await sleep(0)
        }
        translator.KillLs()
        globalThis.mwindow.webContents.send('alert', '완료되었습니다');
        globalThis.mwindow.webContents.send('loading', 0);
    } catch (err) {
        translator.KillLs()
        globalThis.mwindow.webContents.send('alert', {
            icon: 'error',
            message: JSON.stringify(err, Object.getOwnPropertyNames(err))
        });
    }
    globalThis.mwindow.webContents.send('worked', 0);
}
