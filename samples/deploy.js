const { apiClient, passphrase, cryptography } = require('lisk-sdk');
const fs = require('fs');
const path = require('path');
const { getContractAddress } = require('../dist/application/modules/contract/data_access/contract');

const genesisPassphrase = 'peanut hundred pen hawk invite exclude brain chunk gadget wait wrong ready';

const flipper = require('../sol/flipper.json');

const exec = async () => {
	const client = await apiClient.createWSClient('ws://localhost:8000/ws');
	const senderPassphrase = passphrase.Mnemonic.generateMnemonic();
	const { address: senderAddress, publicKey: senderPublicKey } = cryptography.getAddressAndPublicKeyFromPassphrase(senderPassphrase);
	const fundTx = await client.transaction.create({
		moduleID: 2,
		assetID: 0,
		fee: 100000000n,
		asset: {
			amount: 10000000000n,
			data: '',
			recipientAddress: senderAddress,
		},
	}, genesisPassphrase);
	await client.transaction.send(fundTx);
	console.log('funding to ');
	await new Promise(resolve => setTimeout(resolve, 15000));
	// fund the account
	// const wasm = fs.readFileSync(path.join(__dirname, '..', 'sol', 'flipper.wasm'));
	const createTx = await client.transaction.create({
		moduleID: 1111,
		assetID: 0,
		fee: 100000000n,
		senderPublicKey,
		asset: {
			data: Buffer.from(flipper.contracts['./sol/flipper.sol'].flipper.ewasm.wasm, 'hex'),
			amount: 1000000000n,
			gasLimit: 1000000000n,
			gasPrice: 10000,
		},
	}, senderPassphrase);
	console.log('creating contract');
	await client.transaction.send(createTx);
	await new Promise(resolve => setTimeout(resolve, 15000));
	const contractAddress = getContractAddress(senderAddress, createTx.nonce);
	console.log({
		contractAddress: contractAddress.toString('hex'),
		senderAddress: senderAddress.toString('hex'),
		senderPublicKey: senderPublicKey.toString('hex'), 
		senderPassphrase,
	});
	// const execTx = await client.transaction.create({
	// 	moduleID: 1111,
	// 	assetID: 1,
	// 	fee: 100000000n,
	// 	senderPublicKey,
	// 	asset: {
	// 		address: contractAddress,
	// 		input: Buffer.alloc(0),
	// 		amount: 100000000n,
	// 		gasLimit: 1000000000n,
	// 	},
	// }, senderPassphrase);
	// console.log(execTx);
	// await client.transaction.send(execTx);
	// console.log('execute tx');
	// await new Promise(resolve => setTimeout(resolve, 15000));
	await client.disconnect();
};

exec().catch(console.error);