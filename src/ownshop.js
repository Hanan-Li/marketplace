// Javascript for main page
const { calculateRating } = require('./trust.js');
const electron = require('electron');
const net = electron.remote.net;
const $ = require('jquery');
const create = require('ipfs-http-client');
const { globSource } = require('ipfs-http-client');
const fs = require('fs');
const ipfs = create();

let PeerID = '';
const fileAddress = __dirname + '/data/store';
// console.log('store file address:', fileAddress);

let fileID = ''; // my store id
var storeInfo = { items: [], scores: [] }; // items: [{ id: , name: , price: }], scores: [{ store: , score: }]
let itemID = 0; // for counting items in my store
const knownStore = new Set();
const customer = new Set(); // peers who have bought from me
var trustScore = []; // t: [{ round: , t: [{ peer: , score: }] }]
var peerScore = []; // c: [{ peer: , score: }]
var completePeer = []; // complete t: [{ peer: , score: }]
var globalScore = 0; // my global t value
var scoreResults = []; // [{ peer: , score: }]
const topic = "demazon";

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

    // Add new item to store file
    storeInfo['items'].push({ id: itemID, name: itemName, price: itemPrice });
    itemID = itemID + 1;
    fs.writeFile(fileAddress, JSON.stringify(storeInfo), (err) => {
        if (err) throw err;
    });
    publishIPNS();
    updateItems();
    const msg = new TextEncoder().encode(`publish:${itemName} ${itemPrice} ${fileID}`)
    await ipfs.pubsub.publish(topic, msg)
}

// Search Item
async function searchItem(e) {
    e.preventDefault();
    // clean up search item card
    for (let index = 0; index < 3; index++) {
        document.getElementById(`sith${index}`).innerText = "No Item";
        document.getElementById(`sitp${index}`).innerText = "No price";
        document.getElementById(`sits${index}`).innerText = "No store";
        document.getElementById(`sitr${index}`).innerText = "No rating";
    }
    const searchItemName = document.getElementById('searchItemName').value;
    const candidate = new Set();
    let itemFound = 0;

    // get rating
    const msg = new TextEncoder().encode(`search:${fileID}`)
    await ipfs.pubsub.publish(topic, msg);
    await calculateRating();

    // find match
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
                document.getElementById(`sith${itemFound}`).innerText = item.name;
                document.getElementById(`sitp${itemFound}`).innerText = item.price;
                document.getElementById(`sits${itemFound}`).innerText = store;
                const found = scoreResults.find(element => element.peer === store);
                document.getElementById(`sitr${itemFound}`).innerText = found.score;
                itemFound = itemFound + 1;
            }
        }
    }
}

// Rate Item
async function rateItem(elem) {
    console.log("rate item");
    var idx = elem.value;
    var item = document.getElementById("sith" + idx).innerText;
    var itemStore = document.getElementById("sits" + idx).innerText;
    var rating = document.getElementById("rate" + idx).value;

    if (item !== "No Item" && rating !== "") {
        const found = storeInfo['scores'].find(element => element.store === itemStore);
        if (found == undefined) {
            storeInfo['scores'].push({ store: itemStore, score: parseInt(rating) })
        }
        else {
            found['score'] += parseInt(rating);
        }
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

    await ipfs.pubsub.subscribe(topic, receiveMsg)
    console.log(`subscribed to ${topic}`);
}

// Receive msg from subscription
function receiveMsg(msg) {
    console.log(`receive pubsub msg: ${msg}`);

    // parse the msg
    let data = ab2str(msg.data);
    let idx = data.indexOf(":");
    let query = data.substring(0, idx);
    let arg = data.substring(idx + 1);
    var args = arg.split(" ");

    // handle query
    // publish:<itemName> <itemPrice> <storeId>
    if (query == "publish") {
        // TODO: update display list?
        console.log("new item listed.");
        knownStore.add(args[2]);
    }
    // score:init <store i> <store j> <c_ij>
    // score:<round> <storeId> <t_i>
    // score:<round> <storeId> <t_j> complete
    if (query == "score") {
        if (args.length > 3 && arg[3] == 'complete') { // complete
            scoreResults.push({ peer: arg[1], score: parseInt(arg[2]) });
        }
        if (arg[0] == 'init') {
            if (arg[2] == fileID) {
                peerScore.push({ peer: arg[1], score: parseInt(arg[3]) });
            }
        }
        else {
            if (customer.has(arg[1]) == true) {
                if (args.length > 3 && arg[3] == 'complete') { // complete
                    completePeer.push({ peer: arg[1], score: parseInt(arg[2]) });
                }
                const found = trustScore.find(element => element.round === parseInt(arg[0]));
                if (found == undefined) {
                    trustScore.push({ round: parseInt(arg[0]), t: [{ peer: arg[1], score: parseInt(arg[2]) }] })
                }
                else {
                    found.t.push({ peer: arg[1], score: parseInt(arg[2]) });
                }
            }
        }
    }
    // search:<storeId>
    if (query == "search") {
        if (arg[0] != fileID) {
            calculateRating();
        }
    }
    // buy:<storeId>
    if (query == "buy") {
        if (arg[0] == fileID) {
            customer.add(arg[1]);
        }
    }
}

async function publishIPNS() {
    // add changed store file
    const storeFile = await ipfs.add(globSource(fileAddress, { recursive: false, pin: false }));
    // publish
    const publishFile = await ipfs.name.publish(`/ipfs/${storeFile.cid}`);
    console.log(`published IPNS: ${publishFile.name}`);
    // remove old pinned store file
    // ipfs.pin.rm(`${storeFile.cid}`);
    fileID = publishFile.name;
}

function updateItems() {
    $('#own_items').empty();
    for (let i = 0; i < storeInfo['items'].length; i++) {
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
    await fs.readFile(fileAddress, 'utf8', function (err, data) {
        // Display the file content
        // console.log(data);
        storeInfo = JSON.parse(data);
        // console.log(storeInfo);
        updateItems();
    });
}

async function buyItem(element) {
    console.log("buy item");
    var itemStore = document.getElementById("sits" + idx).innerText;
    const msg = new TextEncoder().encode(`buy:${itemStore} ${fileID}`)
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

module.exports = {
    PeerID, storeInfo, fileID, knownStore, customer, trustScore, peerScore, globalScore, completePeer
}
