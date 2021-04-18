const shop = require("./ownshop.js");
const create = require('ipfs-http-client');
const ipfs = create();

// Based on Algorithm 3 of EigenTrust Paper
let localPeerRating = []; // s_ij: [{ store: , score: }]
let normalizedPeerRating = []; // c_ij: [{ store: , score: }]
let globaltrustRating = {}; // t: {}

let peersWhoHaveBoughtFromMe = {}; // A_i
let peersWhoIHaveBoughtFrom = {}; // B_i

let alphaValue = 0.2;
let topic = 'demazon';

async function calculateRating() {
    console.log(`${shop.fileID} start calculate rating...`);
    // init variables from ownshop.js
    trustScore = []; // t: [{ round: , t: [{ peer: , score: }] }]
    peerScore = []; // c: [{ peer: , score: }]
    completePeer = []; // complete t: [{ peer: , score: }]
    globalScore = 0; // my global t value
    scoreResults = []; // [{ peer: , score: }]
    let e = 1 / shop.knownStore.length;

    // compute local c_ij and pubsub c
    await getPeerRating();
    for (let npr of normalizedPeerRating) {
        const msg = new TextEncoder().encode(`score:init ${fileID} ${npr.store} ${npr.score}`);
        await ipfs.pubsub.publish(topic, msg);
    }
    console.log(`${shop.fileID} sent out c_ij`);

    // calculate t in rounds
    let round = 0;
    if (shop.knownStore.length == 0) {
        shop.globalScore = 0;
        const msg = new TextEncoder().encode(`score:${round} ${shop.fileID} ${shop.globalScore} complete`);
        await ipfs.pubsub.publish(topic, msg);
    }
    else {
        // init t = e
        shop.trustScore.push({ round: 0, t: [] });
        const found = shop.trustScore.find(element => element.round === 0);
        for (let cus of shop.customer) {
            found.t.push({ peer: cus, score: e });
        }
        var prevT = e;
        // wait to receive c_ji from all customers
        while (shop.peerScore.length != shop.customer.length) { }
        while (true) {
            const found = shop.trustScore.find(element => element.round === round);
            // wait to receive t_j from all customers
            while (found.t.length != shop.customer.length) { }
            shop.globalScore = 0;
            for (let cus of shop.customer) {
                let c_ji = shop.peerScore.find(element => element.peer == cus).score;
                let t_j = found.t.find(element => element.peer == cus).score;
                shop.globalScore += c_ji * t_j;
            }
            shop.globalScore *= (1 - alphaValue);
            shop.globalScore += alphaValue * e;

            // pubsub t
            console.log(`round${round}: t=${shop.globalScore}`);
            round += 1;
            if (Math.abs(shop.globalScore - prevT) <= 0.1) {
                const msg = new TextEncoder().encode(`score:${round} ${shop.fileID} ${shop.globalScore} complete`);
                await ipfs.pubsub.publish(topic, msg);
                break;
            }
            else {
                const msg = new TextEncoder().encode(`score:${round} ${shop.fileID} ${shop.globalScore}`);
                await ipfs.pubsub.publish(topic, msg);
            }
            prevT = shop.globalScore;
            shop.trustScore.push({ round: round, t: shop.completePeer });
        }
    }
}

// compute c_ij
async function getPeerRating() {
    localPeerRating = [];
    normalizedPeerRating = [];
    await fs.readFile(fileAddress, 'utf8', function (err, data) {
        localPeerRating = JSON.parse(data).scores;
        console.log(`Local peer rating: ${localPeerRating}`);
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
        console.log(`Normalized peer rating: ${normalizedPeerRating}`);
    });
}

module.exports = {
    calculateRating
};