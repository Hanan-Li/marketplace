// Javascript for main page
const electron = require('electron');
// Importing the net Module from electron remote
const net = electron.remote.net;

const create = require('ipfs-http-client');
const { globSource } = require('ipfs-http-client');
const { CID } = require('ipfs-http-client');
const ipfs = create();
let PeerID = '';
const topic = "demazon";
let DataID = '';
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
    console.log("hihi");

    // TODO: add the newly added item to ipfs, use IPNS to enable mutability

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

    // publish the newly added item to others under the subsciption
    const msg = new TextEncoder().encode('publish:banana')
    await ipfs.pubsub.publish(topic, msg)
    // msg was broadcasted
    console.log(`published to ${topic}`)
}

// Create Store Folder with IPNS
async function createStore() {
    // receive msg from subscription
    const receiveMsg = (msg) => {
        console.log(msg);
        console.log(ab2str(msg.data));
        console.log("received from: ", msg.from);

        // handle the msg
        let data = ab2str(msg.data);
        let idx = data.indexOf(":");
        let query = data.substring(0, idx);
        let arg = data.substring(idx+1);
        console.log(query);
        console.log(arg);
        if (query == "publish") {
            // TODO: update display list
            console.log("add item to display list.");
        }
        // TODO: handle other queries like transaction?
    }

    await ipfs.pubsub.subscribe(topic, receiveMsg)
    console.log(`subscribed to ${topic}`);
}

// Send request to flask server and get response back
function test() {
    var body = JSON.stringify({ "ID": 1 });
    const request = net.request({
        method: 'GET',
        protocol: 'http:',
        hostname: 'localhost',
        port: 5000,
        path: '/test'
    })
    request.on('response', (response) => {
        console.log(`STATUS: ${response.statusCode}`)
        console.log(`HEADERS: ${JSON.stringify(response.headers)}`)
        response.on('data', (chunk) => {
            console.log(`BODY: ${chunk}`)
        })
        response.on('end', () => {
            console.log('No more data in response.')
        })
    });
    request.on('finish', () => {
        console.log('Request is Finished')
    });
    request.on('abort', () => {
        console.log('Request is Aborted')
    });
    request.on('error', (error) => {
        console.log(`ERROR: ${JSON.stringify(error)}`)
    });
    request.on('close', (error) => {
        console.log('Last Transaction has occured')
    });
    request.setHeader('Content-Type', 'application/json');
    request.write(body, 'utf-8');
    request.end();
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
