import { createRequire } from 'module'
const require = createRequire(import.meta.url);

const express = require('express');
const fs = require('fs');
const Web3 = require('web3');
const bodyParser = require('body-parser');
const web3 = new Web3('https://polygon-rpc.com/');
var request = require('request');

import { Identity } from "@semaphore-protocol/identity"
import { Group } from "@semaphore-protocol/group"
import { generateProof } from "@semaphore-protocol/proof"
import { packToSolidityProof } from "@semaphore-protocol/proof"


//the public key file of the consortium of arbitors who are responsible for de-anonymising transactions if reauested to, by a court
//the secret data for each deposit into the pool is given, by the client, to this server 
var consortiumPublicKey = fs.readFileSync('./static/consortiumPubKey.pem', 'utf8')
var severSigningPrivKey = "cccb3f84822dd53c7471f472efb3a84be0bf305c32d7202cb88ab7d6eb5a3cbf";
var semaphoreGroupsContractAddress = "0xe585f0db9ab24dc912404dffb9b28fb8bf211fa6";

const app = express();

app.use(express.json())
app.use(bodyParser.json());

// use the bitquery api to request all MemberAdded events from the semaphoreGroups.sol onchain contract, to use in re-creating the merkle tree
async function getMemberAddedEvents(semaphoreGroupsContractAddress){
    var options = {
    'method': 'POST',
    'url': 'https://graphql.bitquery.io',
    'headers': {
        'Content-Type': 'application/json',
        'X-API-KEY': 'BQY2vzTN2GOyzgDYlmWymcD4fiHhZt0Z'
    },
    body: JSON.stringify({
        "query": "{\n  ethereum {\n    smartContractEvents(options: {desc: \"block.height\", limit: 10},\n      smartContractEvent: {is: \"MemberAdded\"},\n      smartContractAddress: \n      {is: \"" + semaphoreGroupsContractAddress + "\"}) {\n      block {\n        height\n        timestamp {\n          iso8601\n          unixtime\n        }\n      }\n      arguments {\n        value\n        argument\n      }\n    }\n  }\n}",
        "variables": "{}"
    })

    };
    request(options, function (error, response) {
        if (error) throw new Error(error);
        var memberAddedEvents = JSON.parse(response.body)["ethereum"]["smartContractEvents"]
    });
    return memberAddedEvents;

}

//This function allows for us to reconstrict the group (identity commitment merkle tree) object from onchain memberAdd events 
async function reConstructGroup(){
    const group = new Group()
    var MemberAddedEvents = getMemberAddedEvents(semaphoreGroupsContractAddress); // get from alchemy api 
    for (newMember in MemberAddedEvents){
        var identityCommitment = newMember[2];
        group.addMembers(identityCommitment) //add the identity commitment specified in the event to the local group object
    }
    return group
}

//generateMembershipProof() allows us to reconstruct what the withdrawl proof
//should be, based on the secrets which theclient gave to the server.
//What this allows is for the server to ensure that it has been given the correct secret data corresponding
//to the withdrawal request which the client is trying to make

async function reCreateMembershipProof(identitySecret, group) {
    const identity = new Identity(identitySecret) //represents both the trapdor and nullifer secrets as a single string
    const externalNullifier = BigInt(1)
    const signal = "withdrawFromPool";

    const fullProof = await generateProof(identity, group, externalNullifier, signal, {
        zkeyFilePath: "./static/semaphore.zkey",
        wasmFilePath: "./static/semaphore.wasm"
    })
    const solidityProof = packToSolidityProof(fullProof.proof)
    return solidityProof;
}
//Encrypts the secet data with the consortium's public key, and discards the plain text secret data so that it is not
//stored in an unencrypted form on the server, preventing it from being leaked in the event of a server compromise
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

// saves the new encrypted identiy secret to a file to be accessed later
async function saveEncryptedIdentitySecret(newEncryptedSecret){
    fs.readFile('encryptedSecrets.json', function (err, data) {
        var json = JSON.parse(data)
        json.push('search result: ' + currentSearchResult)
    
        fs.writeFile("results.json", JSON.stringify(json))
    })
}


// accepts requests from client that specify the identity secret for a withdrawal proof, and returns a signature for the withdrawl request
// checks that the identity secret corresponds to the provided withdrawl request
// the client will then provide the signature to the smart contract in order to authorise the withdrawl
app.post('/', async (req, res) => {
    var signature = "";
    //const signingAddress = web3.eth.accounts.recover("Hello world", signature.signature, true);
    var identitySecret = req.body.identitySecret;
    var withdrawlProof = req.body.withdrawlProof;
    const group = reConstructGroup();
    var reCreatedWithdrawlProof = reCreateMembershipProof(identitySecret, group);

    // check that locally re-created withdrawl proof matches one given by client
    if (withdrawlProof == reCreatedWithdrawlProof){
        var signature = await web3.eth.accounts.sign(withdrawlProof, severSigningPrivKey);
        var encryptedIdentiySecret = encryptForConsortium(identitySecret);
        saveEncryptedIdentitySecret(encryptedIdentiySecret); // save encrypted identity secret to a file so that consortium can access it in the future if requested to by a court
    }
    //the client will then submit the server's signature to the smart contract, as an authorisation for carrying out a public withdrawl 
    res.send(JSON.stringify({"signedWithdrawlProof": signature.signature}))
});

app.listen(3000, () => console.log('ESC server is listening on port 3000.'));