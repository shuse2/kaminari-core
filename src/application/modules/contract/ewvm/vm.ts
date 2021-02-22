import { Worker } from 'worker_threads';
import { utils, cryptography } from 'lisk-sdk';
import * as path from 'path';
import { VMCommunicationExecuted, VMCommunicationFromThread, VMExecParam, VMWorkerData } from '../types';
import { SyncCalls } from '../sync-calls';
import { createContract, destructContract, getContract, updateContractValue } from '../data_access/contract';

export class VM {
	private readonly _mutex: utils.jobHandlers.Mutex;
	private readonly _syncCalls: SyncCalls;
	private _usedGas: bigint;

	constructor() {
		this._mutex = new utils.jobHandlers.Mutex();
		this._syncCalls = new SyncCalls();
		this._usedGas = BigInt(0);
	}

	async execute(param: VMExecParam): Promise<VMCommunicationExecuted> {
		return this._mutex.runExclusive(async () => {
			const worker = this._getNewWorker(param);
			const executionResult = await this._run(worker, param);
			return executionResult;
		});
	}

	public get usedGas(): bigint {
		return this._usedGas;
	}

	private async _run(worker: Worker, param: VMExecParam): Promise<VMCommunicationExecuted> {
		return new Promise((resolve, reject) => {
			const done = (message: VMCommunicationFromThread) => {
				if (message.action === 'executed') {
					worker.off('message', done);
					this._usedGas += BigInt(message.usedGas);
					resolve(message);
				}
			};
			// eslint-disable-next-line @typescript-eslint/no-misused-promises
			worker.on('message', async (message: VMCommunicationFromThread) => {
				switch (message.action) {
					case 'executed':
						done(message);
						break;
					case 'storageLoad':
						await this._syncCalls.handleSyncCall(async () => {
							const result = await param.stateStore.chain.get(`ewvm:${param.callee.toString('binary')}:${Buffer.from(message.key).toString('binary')}`);
							return result;
						});
						break;
					case 'storageStore':
						await this._syncCalls.handleSyncCall(async () => {
							await param.stateStore.chain.set(`ewvm:${param.callee.toString('binary')}:${Buffer.from(message.key).toString('binary')}`, Buffer.from(message.value));
							return undefined;
						});
						break;
					case 'getExternalBalance':
						await this._syncCalls.handleSyncCall(async () => {
							const { address } = message;
							let balance: bigint;
							try {
								balance = await param.reducerHandler.invoke<bigint>('token:getBalance', { address });
							} catch (error) {
								balance = BigInt(0);
							}
							const result = Buffer.alloc(16);
							result.writeBigUInt64LE(balance, 0);
							return result;
						});
						break;
					case 'getBlockHash':
						// eslint-disable-next-line @typescript-eslint/require-await
						await this._syncCalls.handleSyncCall(async () => {
							const blockHeader = param.stateStore.chain.lastBlockHeaders.find(bh => bh.height === message.number);
							if (!blockHeader) {
								throw new Error(`Block header at ${message.number} not found`);
							}
							return blockHeader.id;
						});
						break;
					case 'getExternalCode':
						await this._syncCalls.handleSyncCall(async () => {
							const contract = await getContract(param.stateStore, message.address);
							return contract.code;
						});
						break;
					case 'create':
						await this._syncCalls.handleSyncCall(async () => {
							// create contract
							const value = message.value.readBigUInt64LE();
							const contract = await createContract(param.stateStore, param.origin, param.originNonce, param.caller, value, message.data);
							// transfer value to the created contract
							await updateContractValue(param.stateStore, param.caller, value * BigInt(-1));
							return contract.address;
						});
						break;
					case 'log':
						param.channel.publish('smart-contract', {
							action: 'log',
							data: message.data.toString('hex'),
							topics: message.topics.map(t => t.toString('hex')),
						});
						break;
					case 'selfDestruct':
						await this._syncCalls.handleSyncCall(async () => {
							await destructContract(param.stateStore, message.address);
							return undefined;
						});
						break;
					case 'call':
						await this._syncCalls.handleSyncCall(async () => {
							const value = message.value.readBigUInt64LE();
							const contract = await getContract(param.stateStore, message.address);
							const newParam: VMExecParam = {
								...param,
								balance: value,
								code: contract.address,
								gasLimit: message.gasLimit,
								input: message.data,
								caller: param.caller,
								callee: contract.address,
							};
							const nestedWorker = this._getNewWorker(newParam);
							const result = await this._run(nestedWorker, param);
							return this._encodeExecutionResult(result);
						});
						break;
					case 'callCode':
						await this._syncCalls.handleSyncCall(async () => {
							const value = message.value.readBigUInt64LE();
							const contract = await getContract(param.stateStore, message.address);
							const newParam: VMExecParam = {
								...param,
								balance: value,
								code: contract.address,
								gasLimit: message.gasLimit,
								input: message.data,
								caller: message.address,
								callee: contract.address,
							};
							const nestedWorker = this._getNewWorker(newParam);
							const result = await this._run(nestedWorker, param);
							return this._encodeExecutionResult(result);
						});
						break;
					case 'callDelegate':
						await this._syncCalls.handleSyncCall(async () => {
							const contract = await getContract(param.stateStore, message.address);
							const newParam: VMExecParam = {
								...param,
								code: contract.address,
								gasLimit: message.gasLimit,
								input: message.data,
								caller: message.address,
								callee: contract.address,
							};
							const nestedWorker = this._getNewWorker(newParam);
							const result = await this._run(nestedWorker, param);
							return this._encodeExecutionResult(result);
						});
						break;
					case 'callStatic':
						await this._syncCalls.handleSyncCall(async () => {
							const contract = await getContract(param.stateStore, message.address);
							const newParam: VMExecParam = {
								...param,
								code: contract.address,
								gasLimit: message.gasLimit,
								input: message.data,
								caller: message.address,
								callee: contract.address,
								immutable: true,
							};
							const nestedWorker = this._getNewWorker(newParam);
							const result = await this._run(nestedWorker, param);
							return this._encodeExecutionResult(result);
						});
						break;
					default:
						reject(new Error(`Invalid message call with action ${JSON.stringify(message)}`));
				}
			});
		});
	}

	// eslint-disable-next-line class-methods-use-this
	private _encodeExecutionResult(result: VMCommunicationExecuted): Buffer {
		const resultStatus = Buffer.alloc(4);
		resultStatus.writeInt32LE(result.resultStatus, 0);
		return Buffer.concat([resultStatus, result.resultData]);
	}

	private _getNewWorker(param: VMExecParam): Worker {
		const [lastBlockHeader] = param.stateStore.chain.lastBlockHeaders;
		const generatorAddress = cryptography.getAddressFromPublicKey(lastBlockHeader.generatorPublicKey);
		const workerData: VMWorkerData = {
			sharedBuffer: this._syncCalls.sharedBuffer,
			lastBlockHeight: lastBlockHeader.height,
			lastBlockTimestamp: lastBlockHeader.timestamp,
			origin: param.origin,
			code: param.code,
			input: param.input,
			callee: param.callee,
			caller: param.caller,
			generatorAddress,
			gasLimit: param.gasLimit,
			gasPrice: param.gasPrice,
			balance: param.balance,
			immutable: param.immutable,
		};
		const worker = new Worker(path.join(__dirname, 'worker.js'), {
			workerData,
		});
		return worker;
	}
}
