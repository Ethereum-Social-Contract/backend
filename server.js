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
var consortiumPublicKey = fs.readFileSync('consortiumPubKey.pem', 'utf8')

const app = express();
//const account = web3.eth.accounts.privateKeyToAccount("cccb3f84822dd53c7471f472efb3a84be0bf305c32d7202cb88ab7d6eb5a3cbf");
//web3.eth.accounts.wallet.add(account);

app.use(express.json())
app.use(bodyParser.json());

async function generateDemoProof () {
    const identity = new Identity()
    const group = new Group()
    const externalNullifier = BigInt(1)
    const signal = "Hello world";
    group.addMembers([identity.generateCommitment()])

    const fullProof = await generateProof(identity, group, externalNullifier, signal, {
        zkeyFilePath: "./static/semaphore.zkey",
        wasmFilePath: "./static/semaphore.wasm"
    })
    return fullProof
}


async function verifyInclusionProof(inclusionProof, identityCommitment){
    console.log(inclusionProof)
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