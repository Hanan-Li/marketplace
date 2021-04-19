const { ipcRenderer } = require('electron')
const create = require('ipfs-http-client');
const { globSource } = require('ipfs-http-client');
const { CID } = require('ipfs-http-client');
const fs = require('fs');
const ipfs = create();
const $ = require('jquery');

let PeerID = ipcRenderer.sendSync('getPeerId', 'getPeerId');
let IPNSNode = ipcRenderer.sendSync('getIPNSId', 'getIPNSId');
let allStoreMetadataIPNS = ipcRenderer.sendSync('getStoreMetadataIPNS', 'getStoreMetadataIPNS');
let globalTrustRating = ipcRenderer.sendSync('getGlobalTrust', 'getGlobalTrust');
let allStores = {};

function ab2str(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
}

async function getStores(){
    let ipns_path = '/ipns/' + allStoreMetadataIPNS;
    let stores = '';
    for await (const chunk of ipfs.cat(ipns_path)) {
        stores += ab2str(chunk);
    }
    allStores = JSON.parse(stores);
    console.log(allStores);
}

async function getStoreInfo(path){
    let info = '';
    for await (const chunk of ipfs.cat(path)) {
        info += ab2str(chunk);
    }
    storeInfo = JSON.parse(info);
    return storeInfo;
}

function buyItem(IPNS, id){
    console.log("Buy Item");
    console.log(IPNS);
    console.log(id);
    IPNSNode = ipcRenderer.sendSync('getIPNSId', 'getIPNSId');
    let data = { "buyer_id": PeerID, "buyer_IPNS": IPNSNode, "item_id": id};
    console.log(IPNS);
    ipfs.pubsub.publish(IPNS, JSON.stringify(data));
    //Change to rating
    let form = `
    <form id="list item" onSubmit="rateItem(event)">
        <label for="Rate_${IPNS}_${id}" class="form-label">Rate Item</label>
        <input type="number" class="form-control" id="Rate_${IPNS}_${id}" min="1" max="5">
        <button type="submit" class="btn btn-primary">Submit</button>
    </form>
    `;
    $(`#${IPNS}_${id}`).children().last().remove();
    $(`#${IPNS}_${id}`).append(form);
    ipcRenderer.sendSync('buyItem', IPNS);
}

function rateItem(event){
    // DO trust shit
    event.preventDefault();
    console.log(event);
    let rating = parseInt(event["srcElement"].children[1].value);
    let id = event["srcElement"].children[1].id;
    let split_id = id.split("_");
    let ipns = split_id[1];
    let itemId = split_id[2];
    let msg = { "IPNS": ipns, "rating": rating};
    console.log(msg);
    ipcRenderer.sendSync('rateItem', msg);
}

async function updateItemListing(){
    $("#items").empty();
    for(let i = 0; i < allStores["stores"].length; i++){
        let storePeerID = allStores["stores"][i]["peerID"];
        let storeIPNS = allStores["stores"][i]["IPNS"];
        let path = '/ipns/' + storeIPNS;
        let storeInfo = await getStoreInfo(path);
        let rating = 5 * storeInfo["score"] / globalTrustRating;
        let oneStore = `<div id="${storeIPNS}"></div>`;
        $("#items").append(oneStore);
        if(storeInfo["items"].length !== 0){
            $(`#${storeIPNS}`).append(`<h4>Items for shop ${storeIPNS} </h4>`);
            $(`#${storeIPNS}`).append(`<h3>Shop rating ${rating}/5</h3>`);
        }
        for(let j = 0; j < storeInfo["items"].length; j++){
            let id = storeInfo["items"][j]["id"];
            let name = storeInfo['items'][j]['name'];
            let price = storeInfo['items'][j]['price'];
            let oneItem = `
            <div class="card">
            <!-- <img src="..." class="card-img-top" alt="..."> -->
            <div class="card-body" id="${storeIPNS}_${id}">
                <h5 class="card-title" id="ith${j}">${name}</h5>
                <p class="card-text" id="itp${j}">$${price}</p>
                <button onclick="buyItem('${storeIPNS}', '${id}')"type="button" class="btn btn-primary">Buy</button>
            </div>
            </div>`;
            $(`#${storeIPNS}`).append(oneItem);
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    getStores().then((result) =>{
        updateItemListing();
    });
})
