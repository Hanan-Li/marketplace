const shop = require("./ownshop.js");
const create = require('ipfs-http-client');
const { globSource } = require('ipfs-http-client');
const { CID } = require('ipfs-http-client');
const ipfs = create();

// Based on Algorithm 3 of EigenTrust Paper
let trustedNode = false;
let numTrustedNodes = 2;
let p_value = 0;
let localPeerRating = [];
let normalizedPeerRating = [];
let globaltrustRating = {};

let peersWhoHaveBoughtFromMe = {}; // A_i
let peersWhoIHaveBoughtFrom = {}; // B_i

let alphaValue = 0.2;
let topic = shop.fileID + "/handle_trust";

//-------------- COMMUNICATION CHANNEL -------------------------------------------------------------------------
function getTrustScoreEventHandler(msg) {
    console.log(msg);
    let msgJson = JSON.parse(msg);
    let originatingNode = msgJson["IPNS"];
    if (msgJson["type"] === "request_rating") {
        let replyMessage = { "type": "reply_rating", "rating": globaltrustRating[shop.fileID], "IPNS": shop.fileID };
        ipfs.pubsub.publish(originatingNode + "/handle_trust", JSON.stringify(replyMessage));
    }
    else if (msgJson["type"] === "reply_rating") {
        let rating = msgJson["rating"];
        let node = msgJson["IPNS"];
        globaltrustRating[node] = parseFloat(rating);
    }
    else if (msgJson["type"] === "rating_of_me") {
        let rating = msgJson["rating"];
        peersWhoHaveBoughtFromMe[peer] = msg["rating"];
    }

}

// await ipfs.pubsub.subscribe(topic, getTrustScoreEventHandler);

//---------------------------------------------------------------------------------------------------------------
// intializeTrustRatings();

function intializeTrustRatings() {
    if (trustedNode) {
        globaltrustRating[shop.fileID] = 1 / numTrustedNodes;
        p_value = 1 / numTrustedNodes;
    }
    else {
        globaltrustRating[shop.fileID] = 0;
        p_value = 0;
    }
}

function setLocalPeerRating(peerId, rating) {
    if (!(peerId in localPeerRating)) {
        localPeerRating[peerId] = rating;
    }
    else {
        localPeerRating[peerId] += rating;
    }
    let sum = Object.values(localPeerRating).reduce((a, b) => a + b);
    normalizedPeerRating[peerId] = localPeerRating[peerId] / sum;
}

async function getInitialTrustRatingFromClients() {
    for (let storeIPNS in peersWhoHaveBoughtFromMe) {
        let msg = { "type": "request_rating", "IPNS": shop.fileID };
        await ipfs.pubsub.publish(storeIPNS, JSON.stringify(msg));
    }
}

async function calculateRating() {
    // init
    trustScore = []; // t
    peerScore = []; // c
    completePeer = []; // complete t
    globalScore = 0; // my global t value
    scoreResults = [];
    // compute local c_ij
    await getPeerRating();
    for (let npr of normalizedPeerRating) {
        const msg = new TextEncoder().encode('score:' + 'init' + ' ' + fileID + ' ' + npr.store + ' ' + npr.score);
        await ipfs.pubsub.publish(topic, msg);
    }
    let round = 0;
    if (shop.knownStore.length == 0) {
        shop.globalScore = 0;
        const msg = new TextEncoder().encode('score:' + round + ' ' + shop.fileID + ' ' + shop.globalScore + ' complete');
        await ipfs.pubsub.publish(topic, msg);
    }
    else {
        shop.trustScore.push({ round: 0, t: [] });
        const found = shop.trustScore.find(element => element.round === 0);
        for (let cus of shop.customer) {
            found.t.push({ peer: cus, score: 1 / shop.knownStore.length });
        }
        var prevT = 1 / shop.knownStore.length;
        while (shop.peerScore.length != shop.customer.length) { }
        while (true) {
            const found = shop.trustScore.find(element => element.round === round);
            while (found.t.length != shop.customer.length) { }
            shop.globalScore = 0;
            for (let cus of shop.customer) {
                shop.globalScore += shop.peerScore.find(element => element.peer == cus).score * shop.trustScore.find(element => element.round == round).t.find(element => element.peer == cus).score;
            }
            shop.globalScore *= (1 - alphaValue);
            shop.globalScore += alphaValue / shop.knownStore.length;
            // pubsub
            round += 1;
            if (Math.abs(shop.globalScore - prevT) <= 0.1) {
                const msg = new TextEncoder().encode('score:' + round + ' ' + shop.fileID + ' ' + shop.globalScore + ' complete');
                await ipfs.pubsub.publish(topic, msg);
                break;
            }
            else {
                const msg = new TextEncoder().encode('score:' + round + ' ' + shop.fileID + ' ' + shop.globalScore);
                await ipfs.pubsub.publish(topic, msg);
            }
            prevT = shop.globalScore;
            shop.trustScore.push({ round: round, t: shop.completePeer });
        }
    }

    // let round = 0;
    // const msg = new TextEncoder().encode('score:' + round + ' ' + fileID + ' ' + npr.score);
    // await ipfs.pubsub.publish(topic, msg);
    await getInitialTrustRatingFromClients();
    await sleep(2000);
    while (true) {
        // Calculating new store rating of myself
        let newStoreRating = 0;
        for (let storeIPNS in peersWhoHaveBoughtFromMe) {
            newStoreRating += peersWhoHaveBoughtFromMe[storeIPNS];
        }
        newStoreRating = newStoreRating * (1 - alphaValue) + alphaValue * p_value;
        globaltrustRating[shop.fileID] = newStoreRating;

        // Sending My ratings of peers I have bought from
        for (let storeIPNS in peersWhoIHaveBoughtFrom) {
            let node = storeIPNS;
            let rating = normalizedPeerRating[node] * globaltrustRating[shop.fileID];
            let msg = { "type": "rating_of_me", "rating": rating, "IPNS": shop.fileID };
            await ipfs.pubsub.publish(node + "/handle_trust", JSON.stringify(msg));
        }
        await sleep(5000);

    }
    shop.complete_rating = true;
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// compute c_ij
async function getPeerRating() {
    localPeerRating = [];
    normalizedPeerRating = [];
    await fs.readFile(fileAddress, 'utf8', function (err, data) {
        // Display the file content
        // console.log(data);
        localPeerRating = JSON.parse(data).scores;
        console.log("local peer rating: ", localPeerRating);
        if (localPeerRating.length > 0) {
            let sum = Object.values(localPeerRating).map(el => el.score).reduce((a, b) => a + b);
            for (let peer of localPeerRating) {
                normalizedPeerRating.push({ store: peer.store, score: peer.score / sum });
            }
        }
        // else { // node i is inactive/new
        //     for (let peer of shop.knownStore) {
        //         normalizedPeerRating.push({store: peer, score: 1 / shop.knownStore.length});
        //     }
        // }
        console.log("normalized peer rating: ", normalizedPeerRating);
    });
}

// calculateRating();

module.exports = {
    calculateRating
};