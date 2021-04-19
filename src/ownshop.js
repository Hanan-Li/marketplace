// Javascript for main page
const electron = require('electron');
const net = electron.remote.net;
const $ = require('jquery');
const create = require('ipfs-http-client');
const { globSource } = require('ipfs-http-client');
const fs = require('fs');
const ipfs = create();

let PeerID = '';
const fileAddress = __dirname + '/data/store';
var storeInfo = { items: [], scores: []}; // items: [{ id: , name: , price: }], scores: [{ store: , score: }]
let itemID = 0; // for counting items in my store

const knownStore = new Set();
const customer = new Set(); // peers who have bought from me
let fileID = ''
// for debug
fileID = 'k51qzi5uqu5dky24v2pnpcotcpa57anterwpcrtv0wxyadwrl8by1afehya3kt'; // my store id
knownStore.add("k51qzi5uqu5dkhrjhbeiodogo6uqogdiyqmte2le0tw6i96qssm9qe868m33e0");
customer.add("k51qzi5uqu5dkhrjhbeiodogo6uqogdiyqmte2le0tw6i96qssm9qe868m33e0");


var trustScore = []; // t: [{ round: , t: [{ peer: , score: }] }]
var peerScore = []; // c: [{ peer: , score: }]
var completePeer = []; // complete t: [{ peer: , score: }]
var globalScore = 0; // my global t value
var scoreResults = []; // [{ peer: , score: }]
const topic = "demazon";

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
            storeInfo['scores'].push({ store: itemStore, score: parseFloat(rating) })
        }
        else {
            found['score'] += parseFloat(rating);
        }
        const fs = require('fs');
        fs.writeFile(fileAddress, JSON.stringify(storeInfo), (err) => {
            if (err) throw err;
        });
    }
}

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
    // parse the msg
    let data = ab2str(msg.data);
    console.log("receive pubsub msg: ", data);
    let idx = data.indexOf(":");
    let query = data.substring(0, idx);
    let info = data.substring(idx + 1);
    var args = info.split(" ");

    // handle query
    // publish:<itemName> <itemPrice> <storeId>
    if (query == "publish") {
        // TODO: update display list?
        knownStore.add(args[2]);
        console.log(`add ${args[2]} to known store`);
    }
    // score:init <store i> <store j> <c_ij>
    // score:<round> <storeId> <t_i>
    // score:<round> <storeId> <t_j> complete
    if (query == "score") {
        if (args.length > 3 && args[3] == 'complete') { // complete
            scoreResults.push({ peer: args[1], score: parseFloat(args[2]) });
        }
        if (args[0] == 'init') {
            if (customer.has(args[1]) == true && args[2] == fileID) {
                peerScore.push({ peer: args[1], score: parseFloat(args[3]) });
            }
        }
        else {
            if (customer.has(args[1]) == true) {
                let ps = { peer: args[1], score: parseFloat(args[2]) };
                if (args.length > 3 && args[3] == 'complete') { // complete
                    completePeer.push(ps);
                }
                const found = trustScore.find(element => element.round === parseInt(args[0]));
                if (found == undefined) {
                    trustScore.push({ round: parseInt(args[0]), t: [ps] })
                }
                else {
                    found.t.push(ps);
                }
            }
        }
    }
    // search:<storeId>
    if (query == "search") {
        if (args[0] != fileID) {
            calculateRating();
        }
    }
    // buy:<storeId>
    if (query == "buy") {
        if (args[0] == fileID) {
            customer.add(args[1]);
        }
    }
}

async function publishIPNS() {
    // add changed store file
    const storeFile = await ipfs.add(globSource(fileAddress, { recursive: false, pin: false }));
    // publish
    const publishFile = await ipfs.name.publish(`/ipfs/${storeFile.cid}`);
    // remove old pinned store file
    // ipfs.pin.rm(`${storeFile.cid}`);
    fileID = publishFile.name;
    console.log(`published IPNS: ${publishFile.name}`);
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
        console.log("load store info: ", storeInfo);
        updateItems();
    });
}

async function buyItem(element) {
    console.log("***buy item");
    var itemStore = document.getElementById("sits" + element.value).innerText;
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
    readStoreFile();
    createStore();
})



//-----------------------------------trust algorithm-------------------------------------------------------
// Based on Algorithm 3 of EigenTrust Paper
var localPeerRating = []; // s_ij: [{ store: , score: }]
var normalizedPeerRating = []; // c_ij: [{ store: , score: }]
var globaltrustRating = {}; // t: {}

var peersWhoHaveBoughtFromMe = {}; // A_i
var peersWhoIHaveBoughtFrom = {}; // B_i

var alphaValue = 0.2;

async function calculateRating() {
    console.log(`${fileID} start calculate rating...`);
    // init
    trustScore = []; // t: [{ round: , t: [{ peer: , score: }] }]
    peerScore = []; // c: [{ peer: , score: }]
    completePeer = []; // complete t: [{ peer: , score: }]
    globalScore = 0; // my global t value
    scoreResults = []; // [{ peer: , score: }]
    let e = 1 / knownStore.size;

    // compute local c_ij and pubsub c
    await getPeerRating();
    for (let npr of normalizedPeerRating) {
        if (fileID != npr.store) {
            const msg = new TextEncoder().encode(`score:init ${fileID} ${npr.store} ${npr.score}`);
            await ipfs.pubsub.publish(topic, msg);
        }
    }
    console.log(`${fileID} sent out c_ij`);

    // calculate t in rounds
    let round = 0;
    if (knownStore.size == 0) {
        globalScore = 0;
        const msg = new TextEncoder().encode(`score:${round} ${fileID} ${globalScore} complete`);
        await ipfs.pubsub.publish(topic, msg);
    }
    else {
        // init t = e
        trustScore.push({ round: 0, t: [] });
        const found = trustScore.find(element => element.round === 0);
        for (let cus of customer) {
            found.t.push({ peer: cus, score: e });
        }
        var prevT = e;
        // wait to receive c_ji from all customers
        while (peerScore.length != customer.size) { }
        while (true) {
            const found = trustScore.find(element => element.round === round);
            // wait to receive t_j from all customers
            while (found.t.length != customer.size) { }
            globalScore = 0;
            for (let cus of customer) {
                let c_ji = peerScore.find(element => element.peer == cus).score;
                let t_j = found.t.find(element => element.peer == cus).score;
                globalScore += c_ji * t_j;
            }
            globalScore *= (1 - alphaValue);
            globalScore += alphaValue * e;

            // pubsub t
            console.log(`round${round}: t=${globalScore}`);
            round += 1;
            if (Math.abs(globalScore - prevT) <= 0.1) {
                const msg = new TextEncoder().encode(`score:${round} ${fileID} ${globalScore} complete`);
                await ipfs.pubsub.publish(topic, msg);
                break;
            }
            else {
                const msg = new TextEncoder().encode(`score:${round} ${fileID} ${globalScore}`);
                await ipfs.pubsub.publish(topic, msg);
            }
            prevT = globalScore;
            trustScore.push({ round: round, t: completePeer });
        }
    }
}

// compute c_ij
async function getPeerRating() {
    console.log("***get peer rating");
    localPeerRating = storeInfo.scores;
    normalizedPeerRating = [];
    if (localPeerRating.length > 0) {
        let sum = Object.values(localPeerRating).map(el => el.score).reduce((a, b) => a + b);
        for (let peer of localPeerRating) {
            normalizedPeerRating.push({ store: peer.store, score: peer.score / sum });
        }
    }
    // else { // node i is inactive/new
    //     for (let peer of knownStore) {
    //         normalizedPeerRating.push({store: peer, score: 1 / knownStore.size});
    //     }
    // }
}