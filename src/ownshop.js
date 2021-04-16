// Javascript for main page
const electron = require('electron');
// Importing the net Module from electron remote
const net = electron.remote.net;

const create = require('ipfs-http-client');
const { globSource } = require('ipfs-http-client');
const { CID } = require('ipfs-http-client');
const ipfs = create();
let PeerID = '';
const fileAddress = __dirname + '/data/store';
console.log('store file address:', fileAddress);
let fileID = '';
var storeInfo = { items: [], scores: [] };
storeInfo['scores'] = new Map();
let itemID = 0;
const knownStore = new Set();
const topic = "demazon";
// let DataID = '';
ipfs.config.getAll();

createStore();

// Function to get Peer ID
async function getPeerId() {
    const config = await ipfs.config.getAll();
    PeerID = config['Identity']['PeerID'];
}

function ab2str(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
}

// Add Item to IPFS
async function addNewItem(e) {
    e.preventDefault();
    const itemName = document.getElementById('ItemName').value;
    const itemPrice = document.getElementById('ItemPrice').value;
    console.log(itemName);
    console.log(itemPrice);

    // Add new item to store file
    storeInfo['items'].push({ id: itemID, name: itemName, price: itemPrice });
    itemID = itemID + 1;
    const fs = require('fs');
    fs.writeFile(fileAddress, JSON.stringify(storeInfo), (err) => {
        if (err) throw err;
    });
    // publish new item
    publishIPNS();
    // update item card
    updateItemCard();

    // Write file and add to node
    // console.log(__dirname + '/data/test');
    // const fs = require('fs');
    // let data = "hello";
    // fs.writeFile(__dirname + '/data/test', data, (err) => {
    //     if (err) throw err;
    // });
    // if (DataID) {
    //     const oldFile = ipfs.pin.rm(DataID);
    // }
    // const newFile = ipfs.add(globSource(__dirname + '/data/', { recursive: true }));
    // newFile.then(function (val) {
    //     console.log(val['cid']['string']);
    //     DataID = val['cid']['string'];
    // });

    // test();

    // publish the newly added item to others under the subscription
    const msg = new TextEncoder().encode('publish:' + itemName + ' ' + itemPrice + ' ' + fileID)
    await ipfs.pubsub.publish(topic, msg)
    // msg was broadcasted
    console.log(`published to ${topic}`)
}

// Search Item
async function searchItem(e) {
    e.preventDefault();
    // clean up search item card
    for (let index = 0; index < 3; index++) {
        document.getElementById("sith" + index).innerText = "No Item";
        document.getElementById("sitp" + index).innerText = "No Item";
        document.getElementById("sits" + index).innerText = "No Item";
    }
    const searchItemName = document.getElementById('searchItemName').value;
    console.log(searchItemName);
    const candidate = new Set();
    let itemFound = 0;
    for (let store of knownStore) {
        console.log(store);
        // console.log(ipfs.cat('/ipns/' + store));
        // console.log(ipfs.name.resolve('/ipns/' + store));
        // for await (const name of ipfs.name.resolve('/ipns/' + store)) {
        //     console.log(name)
        // }
        const chunks = []
        for await (const chunk of ipfs.cat('/ipns/' + store)) {
            chunks.push(chunk);
        }
        const items = JSON.parse(Buffer.concat(chunks).toString());
        console.log(items)
        for (let item of items['items']) {
            console.log(item.name);
            if (item.name == searchItemName) {
                candidate.add(store);
                console.log('find item');
                document.getElementById("sith" + itemFound).innerText = item.name;
                document.getElementById("sitp" + itemFound).innerText = item.price;
                document.getElementById("sits" + itemFound).innerText = store;
                itemFound = itemFound + 1;
            }
        }
    }
    // publish the search query to others under the subscription
    const msg = new TextEncoder().encode('search:' + searchItemName + ' ' + fileID)
    await ipfs.pubsub.publish(topic, msg)
}

// Rate Item
async function rateItem(elem) {
    console.log("rate item");
    var idx = elem.value;
    console.log(idx);
    var item = document.getElementById("sith" + idx).innerText;
    console.log(item);
    var itemStore = document.getElementById("sits" + idx).innerText;
    console.log(itemStore);
    var rating = document.getElementById("rate" + idx).value;
    console.log(rating);
    if (item !== "No Item" && rating !== "") {
        console.log("record rating");
        if (storeInfo['scores'].has(itemStore) == false) {
            storeInfo['scores'].set(itemStore, parseInt(rating));
        }
        else {
            storeInfo['scores'].set(itemStore, storeInfo['scores'].get(itemStore) + parseInt(rating));
        }
        console.log(storeInfo['scores']);
        console.log(storeInfo);
        const fs = require('fs');
        fs.writeFile(fileAddress, JSON.stringify(storeInfo, replacer), (err) => {
            if (err) throw err;
        });
    }
}

// Create Store
async function createStore() {
    // Create initial store file with ipns
    console.log('initialize store file');
    // Create file store if not exist under data/ folder
    // const fs = require('fs');
    // fs.writeFile(fileAddress, '', (err) => {
    //     if (err) throw err;
    // });
    publishIPNS();

    // Receive msg from subscription
    console.log("receive pubsub msg");
    const receiveMsg = (msg) => {
        console.log(msg);
        console.log(ab2str(msg.data));
        console.log("received from:", msg.from);

        // handle the msg
        let data = ab2str(msg.data);
        let idx = data.indexOf(":");
        let query = data.substring(0, idx);
        let arg = data.substring(idx + 1);
        console.log(query);
        console.log(arg);
        var args = arg.split(" ");
        if (query == "publish") {
            // TODO: update display list
            console.log("new item listed.");
            // add new store to store set
            console.log(args[2]);
            knownStore.add(args[2]);
        }
        // TODO: handle other queries like transaction?
        if (query == "score") {

        }
        if (query == "search") {

        }
    }

    await ipfs.pubsub.subscribe(topic, receiveMsg)
    console.log(`subscribed to ${topic}`);
}

async function publishIPNS() {
    // add changed store file
    const storeFile = await ipfs.add(globSource(fileAddress, { recursive: false, pin: false }));
    console.log(`${storeFile.cid}`)
    // publish
    const publishFile = await ipfs.name.publish(`/ipfs/${storeFile.cid}`);
    console.log(`${publishFile.name}`);
    // remove old pinned store file
    // ipfs.pin.rm(`${storeFile.cid}`);
    fileID = `${publishFile.name}`;
    // console.log(fileID);
}

function updateItemCard() {
    // update item card, only keep first three items for now
    // clean up
    for (let index = 0; index < 3; index++) {
        document.getElementById("ith" + index).innerText = "No Item";
        document.getElementById("itp" + index).innerText = "No Item";
    }
    // update
    for (let index = 0; index < Math.min(3, storeInfo['items'].length); index++) {
        document.getElementById("ith" + index).innerText = storeInfo['items'][index].name;
        document.getElementById("itp" + index).innerText = storeInfo['items'][index].price;
    }
}

function replacer(key, value) {
    if (value instanceof Map) {
        return {
            dataType: 'Map',
            value: Array.from(value.entries()),
        };
    } else {
        return value;
    }
}


// Set PeerID and other information
window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector)
        if (element) element.innerText = text
    }
    getPeerId().then(result => {
        replaceText('PeerId', PeerID);
    });
})
