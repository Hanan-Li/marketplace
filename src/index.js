const { app, BrowserWindow } = require('electron');
const path = require('path');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    }
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  // var pyshell =  require('python-shell');
  // pyshell.defaultOptions = {
  //   scriptPath: __dirname
  // };
  // pyshell.run('engine.py', null, function (err, results) {
  //  if (err) throw err;
  //  console.log('hello.py finished.');
  //  console.log('results', results);
  // });
};


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

//Setting up ipfs and other states for application
const { ipcMain } = require('electron');
// IPFS Includes
const create = require('ipfs-http-client');
const { globSource } = require('ipfs-http-client');
const { CID } = require('ipfs-http-client');
const fs = require('fs');
const ipfs = create();

// Variables
const fileAddress = __dirname + '/data/store';
let PeerID = '';
var storeInfo = { items: [], scores: [] };
storeInfo['scores'] = new Map();
let IPNSNode = '';
let registerStoreTopic = 'registerDemazonStore';
let selfStoreTopic = '';

//Trusted Node Variables
let trustedNode = true;
let allStores = { stores: [] };
let allstoresFileAddr = __dirname + '/data/allStores';
let allstoreIPNSNode = '';

// Read Stores Metadata from file system-----------------------------------------------------
async function readStoreFile() {
  await fs.readFile(fileAddress, 'utf8', function(err, data){
    
      // Display the file content
      storeInfo = JSON.parse(data);
  });
}

async function readAllStoreFile() {
  await fs.readFile(allstoresFileAddr, 'utf8', function(err, data){
    
    // Display the file content
    allStores = JSON.parse(data);
  });
}

// Some Utility Functions--------------------------------------------------------------------
async function getPeerId() {
  const config = await ipfs.config.getAll();
  PeerID = config['Identity']['PeerID'];
}

function ab2str(buf) {
  return String.fromCharCode.apply(null, new Uint8Array(buf));
}

async function publishIPNS(fileAddr) {
  // add changed store file
  const storeFile = await ipfs.add(globSource(fileAddr, { recursive: false, pin: false }));
  console.log(`${storeFile.cid}`)
  // publish
  const publishFile = await ipfs.name.publish(`/ipfs/${storeFile.cid}`);
  // remove old pinned store file
  // ipfs.pin.rm(`${storeFile.cid}`);
  IPNSNode = `${publishFile.name}`;
  console.log(IPNSNode);
  let msg = { "IPNS": IPNSNode};
  return msg;
}

// Create Store or Register Stores depending on if trusted node-------------------------------
async function createStore() {
  // Create initial store file with ipns
  console.log('initialize store file');
  return await publishIPNS(fileAddress);
}

// Trusted Node handling registering Stores
async function handleRegisterStore(){
   const receiveMsg = (msg) => {
      console.log(msg);
      console.log(ab2str(msg.data));
      console.log("received from:", msg.from);
      let peerId = msg.from;
      // handle the msg
      let data = ab2str(msg.data);
      let query = JSON.parse(data);
      console.log(query);
      storeInfo = {"peerID": peerId, "IPNS": query["IPNS"]};
      let exists = false;
      for(let i = 0; i < allStores['stores'].length; i++){
        if(peerId === allStores['stores'][i]['peerID']){
          exists = true;
        }
      }
      if(!exists){
        allStores['stores'].push(storeInfo);
        fs.writeFile(allstoresFileAddr, JSON.stringify(allStores), (err) => {
          if (err) throw err;
        });
        publishIPNS(allstoresFileAddr);
      }
      publishIPNS(allstoresFileAddr);
  }

  await ipfs.pubsub.subscribe(registerStoreTopic, receiveMsg);
}

// Store Node handling receiving Buy requests
async function handleReceiveStoreTransaction(){
  const receiveMsg = (msg) => {
    console.log(msg);
    console.log(ab2str(msg.data));
    console.log("received from:", msg.from);
    let peerId = msg.from;
    // handle the msg
    let data = ab2str(msg.data);
    let query = JSON.parse(data);
    // console.log(query);
    // storeInfo = {"peerID": peerId, "IPNS": query["IPNS"]}
    // allStores['stores'].push(storeInfo);
    // fs.writeFile(allstoresFileAddr, JSON.stringify(allStores), (err) => {
    //   if (err) throw err;
    // });
    // publishIPNS(fileAddress);
  }

  await ipfs.pubsub.subscribe(selfStoreTopic, receiveMsg);
}


async function initialize(){
  getPeerId();
  if(trustedNode){
    // Read Files for all stores
    await readAllStoreFile();
    // Register handler for receiving new stores registered.
    await handleRegisterStore();
  }
  else{
    await readStoreFile();
    msg = await createStore();
    console.log(msg);
    await ipfs.pubsub.publish(registerStoreTopic, JSON.stringify(msg));
    selfStoreTopic = msg["IPNS"];
    console.log(selfStoreTopic); 
    await handleReceiveStoreTransaction();
  }
}
// Own Shop Functions---------------------------------------------------------
function addNewItem(newItem){
  storeInfo['items'].push(newItem);
  fs.writeFile(fileAddress, JSON.stringify(storeInfo), (err) => {
    if (err) throw err;
  });
  publishIPNS(fileAddress);
}
initialize();

// FUCK SEARCH
//-----------------------------------------------------------------------------
ipcMain.on('getIPNSId', (event, arg) => {
  console.log(arg) // prints "ping"
  event.returnValue = IPNSNode;
})

ipcMain.on('getPeerId', (event, arg) => {
  console.log(arg) // prints "ping"
  event.returnValue = PeerID;
})

ipcMain.on('getStoreInfo', (event, arg) => {
  console.log(arg) // prints "ping"
  event.returnValue = storeInfo;
})

ipcMain.on('addNewItem', (event, arg) => {
  console.log(arg) // prints "ping"
  addNewItem(arg);
  event.returnValue = storeInfo;
})