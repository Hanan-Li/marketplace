const {calculateRating} = require('./trust.js');
// Javascript for main page
const electron = require('electron');
// Importing the net Module from electron remote
const net = electron.remote.net;
const $ = require('jquery');
const create = require('ipfs-http-client');
const { globSource } = require('ipfs-http-client');
const { CID } = require('ipfs-http-client');
const fs = require('fs');
const ipfs = create();
let PeerID = '';
const fileAddress = __dirname + '/data/store';
// console.log('store file address:', fileAddress);
let fileID = '';
var storeInfo = { items: [], scores: [] };
let itemID = 0;
const knownStore = new Set();
const customer = new Set();
const topic = "demazon";
// let DataID = '';
let complete_rating = false;

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
    // console.log(itemName);
    // console.log(itemPrice);

    // Add new item to store file
    storeInfo['items'].push({ id: itemID, name: itemName, price: itemPrice });
    itemID = itemID + 1;
    fs.writeFile(fileAddress, JSON.stringify(storeInfo), (err) => {
        if (err) throw err;
    });
    // publish new item
    publishIPNS();
    // update item card
    updateItems();
    // publish the newly added item to others under the subscription
    const msg = new TextEncoder().encode('publish:' + itemName + ' ' + itemPrice + ' ' + fileID)
    await ipfs.pubsub.publish(topic, msg)
    // msg was broadcasted
    // console.log(`published to ${topic}`)
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
    // console.log(searchItemName);
    const candidate = new Set();
    let itemFound = 0;

    // get rating
    const msg = new TextEncoder().encode('search:' + fileID)
    await ipfs.pubsub.publish(topic, msg);
    while (complete_rating == false) {}
    complete_rating = false;

    for (let store of knownStore) {
        // console.log(store);
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
        // console.log(items)
        for (let item of items['items']) {
            // console.log(item.name);
            if (item.name == searchItemName) {
                candidate.add(store);
                // console.log('find item');
                document.getElementById("sith" + itemFound).innerText = item.name;
                document.getElementById("sitp" + itemFound).innerText = item.price;
                document.getElementById("sits" + itemFound).innerText = store;
                itemFound = itemFound + 1;
            }
        }
    }
    // publish the search query to others under the subscription
    // const msg = new TextEncoder().encode('search:' + searchItemName + ' ' + fileID)
    // await ipfs.pubsub.publish(topic, msg)
}

// Rate Item
async function rateItem(elem) {
    console.log("rate item");
    var idx = elem.value;
    // console.log(idx);
    var item = document.getElementById("sith" + idx).innerText;
    // console.log(item);
    var itemStore = document.getElementById("sits" + idx).innerText;
    // console.log(itemStore);
    var rating = document.getElementById("rate" + idx).value;
    // console.log(rating);
    if (item !== "No Item" && rating !== "") {
        // console.log("record rating");
        const found = storeInfo['scores'].find(element => element.store === itemStore);
        if (found == undefined) {
            storeInfo['scores'].push({store: itemStore, score: parseInt(rating)})
        }
        else {
            found['score'] += parseInt(rating);
        }
        // console.log(storeInfo['scores']);
        // console.log(storeInfo);
        const fs = require('fs');
        fs.writeFile(fileAddress, JSON.stringify(storeInfo), (err) => {
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
    const receiveMsg = (msg) => {
        console.log("receive pubsub msg", msg);
        // console.log(msg);
        // console.log(ab2str(msg.data));
        // console.log("received from:", msg.from);

        // handle the msg
        let data = ab2str(msg.data);
        let idx = data.indexOf(":");
        let query = data.substring(0, idx);
        let arg = data.substring(idx + 1);
        // console.log(query);
        // console.log(arg);
        var args = arg.split(" ");
        if (query == "publish") {
            // TODO: update display list
            console.log("new item listed.");
            // add new store to store set
            // console.log(args[2]);
            knownStore.add(args[2]);
        }
        // TODO: handle other queries like transaction?
        if (query == "score") {
            if (arg[1] == "") {

            }
        }
        if (query == "search") {
            calculateRating();
        }
        if (query == "buy") {
            if (arg[0] == fileID) {
                customer.add(arg[1]);
            }
        }
    }

    await ipfs.pubsub.subscribe(topic, receiveMsg)
    console.log(`subscribed to ${topic}`);
}

async function publishIPNS() {
    // add changed store file
    const storeFile = await ipfs.add(globSource(fileAddress, { recursive: false, pin: false }));
    // console.log(`${storeFile.cid}`)
    // publish
    const publishFile = await ipfs.name.publish(`/ipfs/${storeFile.cid}`);
    console.log("published IPNS: ", `${publishFile.name}`);
    // remove old pinned store file
    // ipfs.pin.rm(`${storeFile.cid}`);
    fileID = `${publishFile.name}`;
    // console.log(fileID);
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

function updateItems() {
    
    // console.log("shit");
    $('#own_items').empty();
    for(let i = 0; i < storeInfo['items'].length; i++){
        let id = storeInfo['items'][i]['id'];
        let name = storeInfo['items'][i]['name'];
        let price = storeInfo['items'][i]['price'];
        let oneItem = `
        <div class="card">
        <!-- <img src="..." class="card-img-top" alt="..."> -->
        <div class="card-body">
            <h5 class="card-title" id="ith${i}">${name}</h5>
            <p class="card-text" id="itp${i}">$${price}</p>
            <a href="#" class="btn btn-primary">Get Bids</a>
        </div>
        </div>`;
        $('#own_items').append(oneItem);
    }
}

async function readStoreFile() {
    await fs.readFile(fileAddress, 'utf8', function(err, data){
      
        // Display the file content
        // console.log(data);
        storeInfo = JSON.parse(data);
        // console.log(storeInfo);
        updateItems();
    });
}

async function buyItem(element) {
    console.log("***buy item");
    var itemStore = document.getElementById("sits" + idx).innerText;
    const msg = new TextEncoder().encode('buy:' + itemStore + ' ' + fileID)
    await ipfs.pubsub.publish(topic, msg)
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
    // readStoreFile();
})

module.exports={
    PeerID, storeInfo, fileID, knownStore, complete_rating, customer
}
