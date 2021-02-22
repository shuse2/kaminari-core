const { apiClient, passphrase, cryptography } = require('lisk-sdk');
const abi = require('ethereumjs-abi');

const input = {
  contractAddress: '71a55cbe5d2272758fc8676c853345722259bcba',
  senderAddress: '980d0624c403ca5fd6c53270bcdfc53e9e0aa965',
  senderPublicKey: '87d1538fee3b3ce22a3b8da41b831a08d99aee88c60e4eb846ce9e117dd84bee',
  senderPassphrase: 'spider gaze peanut okay sleep tribe opera woman castle elegant drop reject'
};


const contractAddress = Buffer.from(input.contractAddress, 'hex');
const senderPublicKey = Buffer.from(input.senderPublicKey, 'hex');
const senderPassphrase = input.senderPassphrase;

const exec = async () => {
	console.log('*'.repeat(100));
	console.log('Calling "flip"')
	console.log('*'.repeat(100));
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

	console.log('*'.repeat(100));
	console.log('Calling "get"')
	console.log('*'.repeat(100));
	const getABIInputGet = abi.methodID('get', [])
	const getTx = await client.transaction.create({
		moduleID: 1111,
		assetID: 1,
		fee: 100000000n,
		senderPublicKey,
		asset: {
			address: contractAddress,
			input: getABIInputGet,
			amount: 100000000n,
			gasLimit: 1000000000n,
		},
	}, senderPassphrase);
	console.log(getTx);
	await client.transaction.send(getTx);
	await new Promise(resolve => setTimeout(resolve, 15000));

	console.log('*'.repeat(100));
	console.log('Calling "getCounter"')
	console.log('*'.repeat(100));
	const getABIInputGetCounter = abi.methodID('getCounter', [])
	const getCounterTx = await client.transaction.create({
		moduleID: 1111,
		assetID: 1,
		fee: 100000000n,
		senderPublicKey,
		asset: {
			address: contractAddress,
			input: getABIInputGetCounter,
			amount: 100000000n,
			gasLimit: 1000000000n,
		},
	}, senderPassphrase);
	console.log(getCounterTx);
	await client.transaction.send(getCounterTx);
	await new Promise(resolve => setTimeout(resolve, 15000));
	await client.disconnect();
};

exec().catch(console.error);