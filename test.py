import os
import json

stream = os.popen('ipfs id')
output = stream.read()
out_dict = json.loads(output)
ID = out_dict["ID"]
print(ID)

stream = os.popen("ipfs swarm peers")
output = stream.read()
peers = []
for line in output.splitlines():
    peers.append(line)

