const { apiClient, passphrase, cryptography } = require('lisk-sdk');
const abi = require('ethereumjs-abi');

const input = {
  contractAddress: 'b3096d1c7553f85277a83ae3ec190c8f3d84e7da',
  senderAddress: '0ace21a9550d5b00b46c915c2d532a277c0f38cc',
  senderPublicKey: '0e55031c1ab49f6f548b5466efd09ba64559d939ce1f8f62de64e49534485bb6',
  senderPassphrase: 'ripple detect mouse try brown pulse animal relax note couch skate fatigue'
};


const contractAddress = Buffer.from(input.contractAddress, 'hex');
const senderPublicKey = Buffer.from(input.senderPublicKey, 'hex');
const senderPassphrase = input.senderPassphrase;

const exec = async () => {
	const input = abi.methodID('flip', [])
	const client = await apiClient.createWSClient('ws://localhost:8000/ws');
	const execTx = await client.transaction.create({
		moduleID: 1111,
		assetID: 1,
		fee: 100000000n,
		senderPublicKey,
		asset: {
			address: contractAddress,
			input,
			amount: 100000000n,
			gasLimit: 1000000000n,
		},
	}, senderPassphrase);
	console.log(execTx);
	await client.transaction.send(execTx);
	await new Promise(resolve => setTimeout(resolve, 15000));
	await client.disconnect();
};

exec().catch(console.error);