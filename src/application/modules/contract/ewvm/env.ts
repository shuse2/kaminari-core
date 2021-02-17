/* eslint-disable arrow-body-style */
import { MessagePort } from 'worker_threads';
import { SyncCalls } from '../sync-calls';
import {
	VMCommunicationAsyncGetExternalBalance,
	VMCommunicationAsyncStorageLoad,
	VMCommunicationAsyncStorageStore,
	VMCommunicationGetBlockHash,
	VMCommunicationGetExternalCode,
	VMCommunicationCreate,
	VMCommunicationLog,
	VMCommunicationSelfDestruct,
	VMCommunicationCallCode,
	VMCommunicationCallDelegate,
	VMCommunicationCall,
} from '../types';
import { RESULT_STATUS_REVERT, RESULT_STATUS_SUCCESS } from './constants';

/* eslint-disable no-console */
interface InitialEnv {
	caller: Buffer;
	callee: Buffer;
	origin: Buffer;
	code: Buffer;
	input: Buffer;
	balance: bigint;
	generatorAddress: Buffer;
	syncCalls: SyncCalls;
	messagePort: MessagePort;
	lastBlockTimestamp: number;
	lastBlockHeight: number;
	gasPrice: number;
	gasLimit: bigint;
	immutable?: boolean;
}

export class Env {
	private readonly _syncCalls: SyncCalls;
	private readonly _messagePort: MessagePort;

	private readonly _caller: Buffer;
	private readonly _callee: Buffer;
	private readonly _origin: Buffer;
	private readonly _code: Buffer;
	private readonly _generatorAddress: Buffer;
	private readonly _input: Buffer;
	private readonly _balance: bigint;
	private readonly _gasLimit: bigint;
	private readonly _gasPrice: number;
	private readonly _lastBlockTimestamp: number;
	private readonly _lastBlockHeight: number;
	private readonly _immutable: boolean;

	private _memory: Buffer;
	private _returnData: Buffer;
	private _output: Buffer;
	private _gasUsed: bigint;
	private _resultStatus: number | undefined;

	constructor(data: InitialEnv) {
		this._syncCalls = data.syncCalls;
		this._messagePort = data.messagePort;

		this._callee = data.callee;
		this._caller = data.caller;
		this._origin = data.origin;
		this._code = data.code;
		this._input = data.input;
		this._balance = data.balance;
		this._generatorAddress = data.generatorAddress;
		this._gasLimit = data.gasLimit;
		this._gasPrice = data.gasPrice;

		this._memory = Buffer.alloc(0);
		this._output = Buffer.alloc(0);
		this._returnData = Buffer.alloc(0);
		this._lastBlockTimestamp = data.lastBlockTimestamp;
		this._lastBlockHeight = data.lastBlockHeight;
		this._gasUsed = BigInt(0);
		this._immutable = data.immutable ?? false;
	}

	public setMemory(memory: SharedArrayBuffer): void {
		this._memory = Buffer.from(memory);
	}

	public get output(): Buffer {
		return this._output;
	}

	public get usedGas(): bigint {
		return this._gasUsed;
	}

	public get resultStatus(): number {
		if (!this._resultStatus) {
			throw new Error('Result not determined');
		}
		return this._resultStatus;
	}

	public get exports(): WebAssembly.ModuleImports {
		return {
			useGas: (amount: bigint) => {
				this._gasUsed += amount;
			},
			getAddress: (addrPtr: number) => {
				this._callee.copy(this._memory, addrPtr);
			},
			getExternalBalance: (addressOffset: number, resultOffset) => {
				const result = this._syncCalls.syncCall(() => {
					const address = Buffer.alloc(32);
					this._memory.copy(address, 0, addressOffset, addressOffset + 32);
					this._messagePort.postMessage({ action: 'getExternalBalance', address } as VMCommunicationAsyncGetExternalBalance);
				});
				const val = result ?? Buffer.alloc(0);
				val.copy(this._memory, resultOffset);
			},
			getBlockHash: (number: BigInt, resultOffset: number): number => {
				try {
					const result = this._syncCalls.syncCall(() => {
						const height = Number(number.toString());
						this._messagePort.postMessage({ action: 'getBlockHash', number: height } as VMCommunicationGetBlockHash);
					});
					if (!result) {
						return 1;
					}
					result.copy(this._memory, resultOffset);
					return 0;
				} catch (error) {
					return 1;
				}
			},
			call: (gas: bigint, addressOffset: number, valueOffset: number, dataOffset: number, dataLength: number): number => {
				const address = Buffer.alloc(20);
				this._memory.copy(address, 0, addressOffset, addressOffset + 20);
				const value = Buffer.alloc(16);
				this._memory.copy(value, 0, valueOffset, valueOffset + 16);
				const callValue = value.readBigUInt64LE();
				if (this._immutable && callValue === BigInt(0)) {
					throw new Error('log cannot be called when called by static');
				}
				const data = Buffer.alloc(dataLength);
				this._memory.copy(data, 0, dataOffset, dataOffset + dataLength);
				try {
					const result = this._syncCalls.syncCall(() => {
						this._messagePort.postMessage({ action: 'call', address, value, data, gasLimit: gas } as VMCommunicationCall);
					});
					if (!result) {
						throw new Error('Result must be set for callCode');
					}
					const { resultStatus, returnData } = this._decodeExecutionResult(result);
					this._returnData = returnData;
					return resultStatus;
				} catch (error) {
					return 1;
				}
			},
			callDataCopy: (resultOffset: number, dataOffset: number, length: number): void => {
				this._input.copy(this._memory, resultOffset, dataOffset, dataOffset + length);
			},
			getCallDataSize: (): number => {
				return this._input.length;
			},
			callCode: (gas: bigint, addressOffset: number, valueOffset: number, dataOffset: number, dataLength: number): number => {
				const address = Buffer.alloc(20);
				this._memory.copy(address, 0, addressOffset, addressOffset + 20);
				const value = Buffer.alloc(16);
				this._memory.copy(value, 0, valueOffset, valueOffset + 16);
				const data = Buffer.alloc(dataLength);
				this._memory.copy(data, 0, dataOffset, dataOffset + dataLength);
				try {
					const result = this._syncCalls.syncCall(() => {
						this._messagePort.postMessage({ action: 'callCode', address, value, data, gasLimit: gas } as VMCommunicationCallCode);
					});
					if (!result) {
						throw new Error('Result must be set for callCode');
					}
					const { resultStatus, returnData } = this._decodeExecutionResult(result);
					this._returnData = returnData;
					return resultStatus;
				} catch (error) {
					return 1;
				}
			},
			callDelegate: (gas: bigint, addressOffset: number, dataOffset: number, dataLength: number): number => {
				const address = Buffer.alloc(20);
				this._memory.copy(address, 0, addressOffset, addressOffset + 20);
				const data = Buffer.alloc(dataLength);
				this._memory.copy(data, 0, dataOffset, dataOffset + dataLength);
				try {
					const result = this._syncCalls.syncCall(() => {
						this._messagePort.postMessage({ action: 'callDelegate', address, data, gasLimit: gas } as VMCommunicationCallDelegate);
					});
					if (!result) {
						throw new Error('Result must be set for callCode');
					}
					const { resultStatus, returnData } = this._decodeExecutionResult(result);
					this._returnData = returnData;
					return resultStatus;
				} catch (error) {
					return 1;
				}
			},
			callStatic: (gas: bigint, addressOffset: number, dataOffset: number, dataLength: number): number => {
				const address = Buffer.alloc(20);
				this._memory.copy(address, 0, addressOffset, addressOffset + 20);
				const data = Buffer.alloc(dataLength);
				this._memory.copy(data, 0, dataOffset, dataOffset + dataLength);
				try {
					const result = this._syncCalls.syncCall(() => {
						this._messagePort.postMessage({ action: 'callDelegate', address, data, gasLimit: gas } as VMCommunicationCallDelegate);
					});
					if (!result) {
						throw new Error('Result must be set for callCode');
					}
					const { resultStatus, returnData } = this._decodeExecutionResult(result);
					this._returnData = returnData;
					return resultStatus;
				} catch (error) {
					return 1;
				}
			},
			storageStore: (pathOffset: number, valueOffset: number): void => {
				this._syncCalls.syncCall(() => {
					const key = Buffer.alloc(32);
					this._memory.copy(key, 0, pathOffset, pathOffset + 32);
					const value = Buffer.alloc(32);
					this._memory.copy(value, 0, valueOffset, valueOffset + 32);
					this._messagePort.postMessage({ action: 'storageStore', key, value } as VMCommunicationAsyncStorageStore);
				});
			},
			storageLoad: (pathOffset: number, resultOffset: number): void => {
				const result = this._syncCalls.syncCall(() => {
					const key = Buffer.alloc(32);
					this._memory.copy(key, 0, pathOffset, pathOffset + 32);
					this._messagePort.postMessage({ action: 'storageLoad', key } as VMCommunicationAsyncStorageLoad);
				});
				if (result) {
					result.copy(this._memory, resultOffset);
				}
			},
			getCaller: (resultOffset: number) => {
				this._caller.copy(this._memory, resultOffset);
			},
			getCallValue: (resultOffset: number): void => {
				const bs = Buffer.alloc(8);
				bs.writeBigUInt64LE(this._balance);
				bs.copy(this._memory, resultOffset);
			},
			codeCopy: (resultOffset: number, codeOffset: number, length: number): void => {
				console.log('calling code copy', resultOffset, codeOffset, length);
				if (length > 0) {
					this._code.copy(this._memory, resultOffset, codeOffset, codeOffset + length);
				}
			},
			getCodeSize: (): number => {
				console.log('calling code size', this._code.length);
				return this._code.length;
			},
			getBlockCoinbase: (resultOffset: number): void => {
				this._generatorAddress.copy(this._memory, resultOffset);
			},
			create: (valueOffset: number, dataOffset: number, dataLength: number, resultOffset: number): number => {
				if (this._immutable) {
					throw new Error('log cannot be called when called by static');
				}
				try {
					const value = Buffer.alloc(32);
					this._memory.copy(value, 0, valueOffset, valueOffset + 32);
					const data = Buffer.alloc(dataLength);
					this._memory.copy(data, 0, dataOffset, dataOffset + dataLength);
					const result = this._syncCalls.syncCall(() => {
						this._messagePort.postMessage({ action: 'create', data, value } as VMCommunicationCreate);
					});
					if (!result) {
						return 1;
					}
					result.copy(this._memory, resultOffset);
					return 0;
				} catch (error) {
					return 1;
				}
			},
			getBlockDifficulty: (_: number) => {
				throw new Error('Invalid function call getBlockDifficulty');
			},
			externalCodeCopy: (addressOffset: number, resultOffset: number, codeOffset: number, length: number) => {
				const code = this._syncCalls.syncCall(() => {
					const address = Buffer.alloc(20);
					this._memory.copy(address, 0, addressOffset, addressOffset + 20);
					this._messagePort.postMessage({ action: 'getExternalCode', address } as VMCommunicationGetExternalCode);
				});
				if (!code) {
					throw new Error('externalCodeCopy failed because address does not have the code');
				}
				code.copy(this._memory, resultOffset, codeOffset, codeOffset + length);
			},
			getExternalCodeSize: (addressOffset: number): number => {
				const code = this._syncCalls.syncCall(() => {
					const address = Buffer.alloc(20);
					this._memory.copy(address, 0, addressOffset, addressOffset + 20);
					this._messagePort.postMessage({ action: 'getExternalCode', address } as VMCommunicationGetExternalCode);
				});
				return code ? code.length : 0;
			},
			getGasLeft: (): bigint => { return this._gasLimit - this._gasUsed; },
			getBlockGasLimit: (): bigint => { return BigInt(0); },
			getTxGasPrice: (resultOffset: number) => {
				const result = Buffer.alloc(16);
				result.writeInt16LE(this._gasPrice, 0);
				result.copy(this._memory, resultOffset);
			},
			log: (dataOffset: number, dataLength: number, numberOfTopics: number, topic1: number, topic2: number, topic3: number, topic4: number) => {
				if (this._immutable) {
					throw new Error('log cannot be called when called by static');
				}
				const data = Buffer.alloc(dataLength);
				this._memory.copy(data, 0, dataOffset, dataOffset + dataLength);
				const topics: Buffer[] = [];
				if (numberOfTopics > 1) {
					const topic = Buffer.alloc(32);
					this._memory.copy(topic, 0, topic1, topic1 + 32);
					topics.push(topic);
				}
				if (numberOfTopics > 2) {
					const topic = Buffer.alloc(32);
					this._memory.copy(topic, 0, topic2, topic2 + 32);
					topics.push(topic);
				}
				if (numberOfTopics > 3) {
					const topic = Buffer.alloc(32);
					this._memory.copy(topic, 0, topic3, topic3 + 32);
					topics.push(topic);
				}
				if (numberOfTopics > 4) {
					const topic = Buffer.alloc(32);
					this._memory.copy(topic, 0, topic4, topic4 + 32);
					topics.push(topic);
				}
				if (numberOfTopics > 5) {
					throw new Error('topic must be less than 4');
				}
				this._syncCalls.syncCall(() => {
					this._messagePort.postMessage({ action: 'log', data, topics } as VMCommunicationLog);
				});
			},
			getBlockNumber: (): bigint => { return BigInt(this._lastBlockHeight); },
			getTxOrigin: (resultOffset: number) => {
				this._origin.copy(this._memory, resultOffset);
			},
			finish: (dataPtr: number, dataLen: number): void => {
				this._output = this._memory.slice(dataPtr, dataPtr + dataPtr + dataLen);
				this._resultStatus = RESULT_STATUS_SUCCESS;
				throw new Error('Finished');
			},
			revert: (dataPtr: number, dataLen: number): void => {
				this._output = this._memory.slice(dataPtr, dataPtr + dataPtr + dataLen);
				this._resultStatus = RESULT_STATUS_REVERT;
				throw new Error('Execution reverted');
			},
			getReturnDataSize: (): number => { return this._returnData.length; },
			returnDataCopy: (resultOffset: number, dataOffset: number, length: number) => {
				this._returnData.copy(this._memory, resultOffset, dataOffset, dataOffset + length);
			},
			selfDestruct: (addressOffset: number) => {
				if (this._immutable) {
					throw new Error('log cannot be called when called by static');
				}
				const address = Buffer.alloc(20);
				this._memory.copy(address, 0, addressOffset, addressOffset + 20);
				this._syncCalls.syncCall(() => {
					this._messagePort.postMessage({ action: 'selfDestruct', address } as VMCommunicationSelfDestruct);
				});
			},
			getBlockTimestamp: (): bigint => { return BigInt(this._lastBlockTimestamp); },
		};
	}

	// eslint-disable-next-line class-methods-use-this
	private _decodeExecutionResult(result: Buffer): { returnData: Buffer; resultStatus: number} {
		const resultStatusBuffer = result.slice(0, 4);
		const returnData = result.slice(4);
		const resultStatus = resultStatusBuffer.readInt32LE(0);
		return {
			returnData,
			resultStatus,
		};
	}
}
