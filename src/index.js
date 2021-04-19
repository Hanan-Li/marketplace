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
var storeInfo = { items: [], score: 0.0 };
let IPNSNode = '';
let registerStoreTopic = 'registerDemazonStore';
let selfStoreTopic = '';

//Trusted Node Variables
let trustedNode = false;
let allStores = { stores: [] };
let allstoresFileAddr = __dirname + '/data/allStores';
let allstoreIPNSNode = 'k51qzi5uqu5dl0bn21jqms8jauzxhlg9a3gmc5f2rdcnluulq1veonr4ckl4nr';

//EigenTrust Variables
let selfStoreRateTopic = '';
let A = {}; // Set of peers who has bought items from me
let B = new Set(); // Set of peers I have bought from
let C = {}; // My rating of each peer
let p = 0; // Change if its a trusted Node
let alpha = 0.2;

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
    console.log(query);
    let boughtId = query["item_id"];
    let buyerId = query["buyer_id"];
    let buyerIPNS = query["buyer_IPNS"];
    console.log("Buyer Id: " + buyerId + " bought item: " + boughtId);
    removeItem(boughtId);
    //TODO: CONNECT WITH TRUST SHIT
    if(!(buyerIPNS in A)){
      A[buyerIPNS] = [];
    }
  }
  console.log("subscribing to store");
  await ipfs.pubsub.subscribe(selfStoreTopic, receiveMsg);
}

// Store Node handling receiving Buy requests
async function handleReceiveRateTransaction(){
  const receiveMsg = (msg) => {
    console.log(msg);
    console.log(ab2str(msg.data));
    console.log("received from:", msg.from);
    let peerId = msg.from;
    // handle the msg
    let data = ab2str(msg.data);
    let query = JSON.parse(data);
    console.log(query);
    let rating = query["rating"];
    let buyerIPNS = query["buyer_IPNS"];
    if(!(buyerIPNS in A)){
      A[buyerIPNS] = [];
    }
    if(A[buyerIPNS].length === 0){
      A[buyerIPNS].push(rating);
    }
    else{
      A[buyerIPNS][0] = parseFloat(rating);
    }
    EigenTrust();
  }
  console.log("subscribing to rate");
  await ipfs.pubsub.subscribe(selfStoreRateTopic, receiveMsg);
}

async function getStoreInfo(path){
  let info = '';
  for await (const chunk of ipfs.cat(path)) {
      info += ab2str(chunk);
  }
  storeInfo = JSON.parse(info);
  return storeInfo;
}

// One Iteration of EigenTrust
async function EigenTrust(){
  let t = 0;
  let eps = 1;
  while(eps >= 0.1){
    for(const ipns in A){
      let rating_list = A[ipns];
      if(rating_list.length === 0){
        return;
      }
      let rating = rating_list[0];
      let storeInfo = await getStoreInfo('/ipns/' + ipns);
      let storeScore = storeInfo["score"];
      t += storeScore * rating;
    }
    t *= (1-alpha);
    t += alpha*p;
    console.log("rating");
    console.log(t);
    eps = Math.abs(t - storeInfo["score"]);
    storeInfo["score"] = t;
    fs.writeFile(fileAddress, JSON.stringify(storeInfo), (err) => {
      if (err) throw err;
    });
    publishIPNS(fileAddress);
  }
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
    selfStoreRateTopic = msg["IPNS"] + "/rating";
    console.log(selfStoreTopic); 
    await handleReceiveStoreTransaction();
    await handleReceiveRateTransaction();
  }
}
// Misc Functions------------------------------------------------------------
function sum(total, num) {
  return total + num;
}
// Own Shop Functions---------------------------------------------------------
function addNewItem(newItem){
  storeInfo['items'].push(newItem);
  fs.writeFile(fileAddress, JSON.stringify(storeInfo), (err) => {
    if (err) throw err;
  });
  publishIPNS(fileAddress);
}

function removeItem(itemId){
  let itemID = parseInt(itemId);
  console.log(itemID);
  for(let i = 0; i < storeInfo["items"].length; i++){
    if (storeInfo["items"][i]["id"] === itemID){
      console.log("foundItem");
      storeInfo["items"].splice(i,1);
      break;
    }
  }

  fs.writeFile(fileAddress, JSON.stringify(storeInfo), (err) => {
    if (err) throw err;
  });
  console.log(storeInfo);
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

ipcMain.on('getStoreMetadataIPNS', (event, arg) => {
  console.log(arg) // prints "ping"
  event.returnValue = allstoreIPNSNode;
})

ipcMain.on('buyItem', (event, arg) => {
  console.log(arg) // prints "ping"
  let boughtFrom = arg;
  B.add(boughtFrom);
  console.log(boughtFrom);
  event.returnValue = allstoreIPNSNode;
})

ipcMain.on('rateItem', (event, arg) => {
  console.log(arg) // prints "ping"
  let boughtFrom = arg["IPNS"];
  let rating = arg["rating"];
  // Publish rating onto ipns channel
  if(!(boughtFrom in C)){
    C[boughtFrom] = [];
  }
  C[boughtFrom].push(rating);
  let numerator = C[boughtFrom].reduce(sum) / C[boughtFrom].length;
  console.log(C);
  console.log(numerator);
  let denominator = 0;
  for(let peer in C){
    let ratingArr = C[peer];
    denominator += ratingArr.reduce(sum) / ratingArr.length;
  }
  rating = p;
  if(denominator !== 0){
    rating = numerator / denominator;
  }
  let topic = boughtFrom + '/rating';
  msg = { "rating" : rating, "ipns" : IPNSNode};
  console.log(msg);
  ipfs.pubsub.publish(topic, JSON.stringify(msg));
  event.returnValue = allstoreIPNSNode;
})
