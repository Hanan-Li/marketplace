// Javascript for main page
const electron = require('electron');
// Importing the net Module from electron remote
const net = electron.remote.net;

const create = require('ipfs-http-client');
const { globSource } = require('ipfs-http-client');
const { CID } = require('ipfs-http-client');
const ipfs = create();
let PeerID = '';
let DataID = '';
ipfs.config.getAll();
// Function to get Peer ID
async function getPeerId() {
    const config = await ipfs.config.getAll();
    PeerID = config['Identity']['PeerID'];
}

// Add Item to IPFS
function addNewItem(e) {
    e.preventDefault();
    const itemName = document.getElementById('ItemName').value;
    const itemPrice = document.getElementById('ItemPrice').value;
    console.log(itemName);
    console.log(itemPrice);
    console.log("hihi");
    console.log(__dirname + '/data/test');
    const fs = require('fs');
    let data = "hello";
    fs.writeFile(__dirname + '/data/test', data, (err) => {
        if (err) throw err;
    });
    if (DataID) {
        const oldFile = ipfs.pin.rm(DataID);
    }
    const newFile = ipfs.add(globSource(__dirname + '/data/', { recursive: true }));
    newFile.then(function (val) {
        console.log(val['cid']['string']);
        DataID = val['cid']['string'];
    });
    // test();
}

// Create Store Folder with IPNS
function createStore() {

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