# marketplace
Built using Electron and js-ipfs http client
## Installation Guide
1. Install IPFS CLI
    1. https://docs.ipfs.io/how-to/command-line-quick-start/
    1. Installing private Networks involve some tinkering with, mainly with port forwarding in routers
1. Install Node js
    1. https://nodejs.org/en/download/
    1. https://nodejs.org/en/download/package-manager/
1. Clone this repository
1. Start App by:
    1. npm install
    1. npm start

## Notes
- ipfs CLI
```bash
# in one terminal: start ipfs with pubsub enabled
ipfs daemon --enable-pubsub-experiment

# in a new terminal: subscribe to topic "demazon"
ipfs pubsub sub demazon

# in a new termial: publish to subscription
ipfs pubsub pub demazon publish:<CID>
```

## Peers
- quyuyiUbuntu: k51qzi5uqu5dkhrjhbeiodogo6uqogdiyqmte2le0tw6i96qssm9qe868m33e0
- quyuyiMac: k51qzi5uqu5dky24v2pnpcotcpa57anterwpcrtv0wxyadwrl8by1afehya3kt