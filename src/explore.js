const base = require("./base.js");
let PeerID = '';
base.getPeerId().then(result => {
    PeerID = result;
});
