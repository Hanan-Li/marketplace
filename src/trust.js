const shop = require("ownshop");
const create = require('ipfs-http-client');
const { globSource } = require('ipfs-http-client');
const { CID } = require('ipfs-http-client');
const ipfs = create();

// Based on Algorithm 3 of EigenTrust Paper
let trustedNode = false;
let numTrustedNodes = 2;
let p_value = 0;
let localPeerRating = {};
let normalizedPeerRating = {};
let globaltrustRating = {};

let peersWhoHaveBoughtFromMe = {}; // A_i
let peersWhoIHaveBoughtFrom = {}; // B_i

let alphavalue = 0.2;
let topic = shop.fileID + "/handle_trust";

//-------------- COMMUNICATION CHANNEL -------------------------------------------------------------------------
function getTrustScoreEventHandler(msg){
    console.log(msg);
    let msgJson = JSON.parse(msg);
    let originatingNode = msgJson["IPNS"];
    if(msgJson["type"] === "request_rating"){
        let replyMessage = {"type" : "reply_rating", "rating": globaltrustRating[shop.fileID],  "IPNS": shop.fileID};
        ipfs.pubsub.publish(originatingNode + "/handle_trust", JSON.stringify(replyMessage));
    }
    else if(msgJson["type"] === "reply_rating"){
        let rating = msgJson["rating"];
        let node =  msgJson["IPNS"];
        globaltrustRating[node] = parseFloat(rating);
    }
    else if(msgJson["type"] === "rating_of_me"){
        let rating = msgJson["rating"];
        peersWhoHaveBoughtFromMe[peer] = msg["rating"];
    }

}

await ipfs.pubsub.subscribe(topic, getTrustScoreEventHandler);

//---------------------------------------------------------------------------------------------------------------
intializeTrustRatings();

function intializeTrustRatings(){
    if(trustedNode){
        globaltrustRating[shop.fileID] = 1/numTrustedNodes;
        p_value = 1/numTrustedNodes;
    }
    else{
        globaltrustRating[shop.fileID] = 0;
        p_value = 0;
    }
}

function setLocalPeerRating(peerId, rating){
    if(!(peerId in localPeerRating)){
        localPeerRating[peerId] = rating;
    }
    else{
        localPeerRating[peerId] += rating;
    }
    let sum = Object.values(localPeerRating).reduce((a, b) => a + b);
    normalizedPeerRating[peerId] = localPeerRating[peerId] / sum;
}

async function getInitialTrustRatingFromClients(){
    for(let storeIPNS in peersWhoHaveBoughtFromMe){
        let msg = { "type": "request_rating", "IPNS": shop.fileID};
        await ipfs.pubsub.publish(storeIPNS, JSON.stringify(msg));
    }
}

async function calculateRating(){
    await getInitialTrustRatingFromClients();
    await sleep(2000);
    while(true){
        // Calculating new store rating of myself
        let newStoreRating = 0;
        for(let storeIPNS in peersWhoHaveBoughtFromMe){
            newStoreRating += peersWhoHaveBoughtFromMe[storeIPNS];
        }
        newStoreRating = newStoreRating * (1-alphavalue) + alphavalue*p_value;
        globaltrustRating[shop.fileID] = newStoreRating;

        // Sending My ratings of peers I have bought from
        for(let storeIPNS in peersWhoIHaveBoughtFrom){
            let node =  storeIPNS;
            let rating = normalizedPeerRating[node] * globaltrustRating[shop.fileID];
            let msg = {"type" : "rating_of_me", "rating": rating,  "IPNS": shop.fileID};
            await ipfs.pubsub.publish(node + "/handle_trust", JSON.stringify(msg));
        }
        await sleep(5000);
        
    }
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

calculateRating();