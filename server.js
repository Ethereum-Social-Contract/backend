import { createRequire } from 'module'
const require = createRequire(import.meta.url);

const express = require('express');
const fs = require('fs');
const Web3 = require('web3');
const bodyParser = require('body-parser');
const web3 = new Web3('https://polygon-rpc.com/');

import { Identity } from "@semaphore-protocol/identity"
import { Group } from "@semaphore-protocol/group"
import { generateProof } from "@semaphore-protocol/proof"
import { verifyProof } from "@semaphore-protocol/proof"
import { packToSolidityProof } from "@semaphore-protocol/proof"

//the public key file of the consortium of arbitors who are responsible for de-anonymising transactions if reauested to, by a court
//the secret data for each deposit into the pool is given, by the client, to this server 
var consortiumPublicKey = fs.readFileSync('consortiumPubKey.pem', 'utf8')

const app = express();
//const account = web3.eth.accounts.privateKeyToAccount("cccb3f84822dd53c7471f472efb3a84be0bf305c32d7202cb88ab7d6eb5a3cbf");
//web3.eth.accounts.wallet.add(account);

app.use(express.json())
app.use(bodyParser.json());



//This function allows for us to reconstrict the 
async function reConstructGroup(){
    const group = new Group()
    var MemberAddedEvents = [] // get from alchemy api 
    for (newMember in MemberAddedEvents){
        var identityCommitment = newMember[2];
        group.addMembers(identityCommitment) //add the identity commitment specified in the event to the local group object
    }
    //Todo: this requires looping through all smart contract deposit events to reconstruct the identityCommitment merkle tree so that it can be manipulated in node js
    return group
}

//generateMembershipProof() allows us to 
async function generateMembershipProof(identitySecret, group) {
    const identity = new Identity()
    const group = reConstructGroup();
    const externalNullifier = BigInt(1)
    const signal = "withdrawFromPool";
    group.addMembers([identity.generateCommitment()])

    const fullProof = await generateProof(identity, group, externalNullifier, signal, {
        zkeyFilePath: "./static/semaphore.zkey",
        wasmFilePath: "./static/semaphore.wasm"
    })
    return fullProof
}


async function generateIdentityCommitment(inclusionProof, identityCommitment){
    console.log(inclusionProof);
    
    identity.generateCommitment();
    const verificationKey = JSON.parse(fs.readFileSync("./static/semaphore.json", "utf-8"))
    var validProof = await verifyProof(verificationKey, inclusionProof) 
    return validProof
}


function encryptForConsortium (plainText) {
    return crypto.publicEncrypt({
      key: consortiumPublicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    // We convert the data string to a buffer
    Buffer.from(plainText)
    )
}

async function saveNewSecrets(newEncryptedSecret){
    fs.readFile('encryptedSecrets.json', function (err, data) {
        var json = JSON.parse(data)
        json.push('search result: ' + currentSearchResult)
    
        fs.writeFile("results.json", JSON.stringify(json))
    })
}

app.post('/', async (req, res) => {
    var signature = "";
    //const signingAddress = web3.eth.accounts.recover("Hello world", signature.signature, true);
    var identityCommitment = req.body.identityCommitment
    //var inclusionProof = req.body.merkleInclusionProof
    
    var inclusionProof = await generateDemoProof()
    var isProofValid = verifyInclusionProof(inclusionProof, "")
    if (isProofValid){
        console.log(identityCommitment)
        signature = await web3.eth.accounts.sign(identityCommitment, "cccb3f84822dd53c7471f472efb3a84be0bf305c32d7202cb88ab7d6eb5a3cbf");
    }
    res.send(JSON.stringify({"signedIdentityCommitment": signature.signature}))
});

app.listen(3000, () => console.log('ESC server is listening on port 3000.'));