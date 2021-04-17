const { ipcRenderer } = require('electron')
console.log(ipcRenderer.sendSync('getPeerId', 'ping')) // prints "pong"
console.log(ipcRenderer.sendSync('getStoreInfo', 'ping'))