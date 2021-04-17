const electron = require('electron');
const  create  = require('ipfs-http-client');
const { globSource } = require('ipfs-http-client');
const { CID } = require('ipfs-http-client');
const fs = require('fs');
const ipfs = create();
let PeerID = '';
let fileID = '';
var storeInfo = { items: [], scores: [] };
storeInfo['scores'] = new Map();

async function getPeerId() {
    const config = await ipfs.config.getAll();
    PeerID = config['Identity']['PeerID'];
    return PeerID;
}

module.exports={
    PeerID, storeInfo, getPeerId
}
