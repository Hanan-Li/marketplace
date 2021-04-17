// Javascript for main page
const { ipcRenderer } = require('electron');// Importing the net Module from electron remote
const $ = require('jquery');
const fs = require('fs');
let PeerID = '';
var storeInfo = { items: [], scores: [] };
storeInfo['scores'] = new Map();
let itemID = 0;
// let DataID = '';


// Add Item to IPFS
async function addNewItem(e) {
    e.preventDefault();
    const itemName = document.getElementById('ItemName').value;
    const itemPrice = document.getElementById('ItemPrice').value;
    console.log(itemName);
    console.log(itemPrice);

    // Add new item to store file
    let new_item = { id: itemID, name: itemName, price: itemPrice };
    storeInfo = ipcRenderer.sendSync('addNewItem', new_item);
    storeInfo['items'].push();
    itemID = itemID + 1;
    
    // update item card
    updateItems(storeInfo);
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

function updateItems(storeInfo) {
    
    console.log("shit");
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


// Set PeerID and other information
window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector)
        if (element) element.innerText = text
    }
    PeerID = ipcRenderer.sendSync('getPeerId', 'ping');
    replaceText('PeerId', PeerID);
    storeInfo = ipcRenderer.sendSync('getStoreInfo', 'ping');
    itemID = storeInfo["items"].length;
    updateItems(storeInfo);
})
