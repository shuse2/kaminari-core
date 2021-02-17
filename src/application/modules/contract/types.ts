import { ReducerHandler, StateStore } from 'lisk-sdk';

export interface ContractState {
	code: Buffer;
	memory: Buffer;
}

export interface VMCommunicationExec {
	action: 'execute';
	code: Buffer;
	input: Buffer;
	caller: Buffer;
	callee: Buffer;
	origin: Buffer;
}
export type VMCommunicationFromParent = VMCommunicationExec;

export interface VMCommunicationAsyncStorageLoad {
	action: 'storageLoad';
	key: Buffer;
}

export interface VMCommunicationAsyncStorageStore {
	action: 'storageStore';
	key: Buffer;
	value: Buffer;
}

export interface VMCommunicationAsyncGetExternalBalance {
	action: 'getExternalBalance';
	address: Buffer;
}

export interface VMCommunicationGetBlockHash {
	action: 'getBlockHash';
	number: number;
}

export interface VMCommunicationGetExternalCode {
	action: 'getExternalCode';
	address: Buffer;
}

export interface VMCommunicationCreate {
	action: 'create';
	value: Buffer;
	data: Buffer;
}

export interface VMCommunicationSelfDestruct {
	action: 'selfDestruct';
	address: Buffer;
}

export interface VMCommunicationLog {
	action: 'log';
	data: Buffer;
	topics: Buffer[];
}

export interface VMCommunicationCall {
	action: 'call';
	gasLimit: bigint;
	address: Buffer;
	value: Buffer;
	data: Buffer;
}

export interface VMCommunicationCallCode {
	action: 'callCode';
	gasLimit: bigint;
	address: Buffer;
	value: Buffer;
	data: Buffer;
}

export interface VMCommunicationCallDelegate {
	action: 'callDelegate';
	gasLimit: bigint;
	address: Buffer;
	data: Buffer;
}

export interface VMCommunicationCallStatic {
	action: 'callStatic';
	gasLimit: bigint;
	address: Buffer;
	data: Buffer;
}

export interface VMCommunicationExecuted {
	action: 'executed';
	resultData: Buffer;
	resultStatus: number;
	usedGas: bigint;
}

export type VMCommunicationFromThread =
	VMCommunicationExecuted |
	VMCommunicationAsyncStorageLoad |
	VMCommunicationAsyncStorageStore |
	VMCommunicationAsyncGetExternalBalance |
	VMCommunicationGetBlockHash |
	VMCommunicationGetExternalCode |
	VMCommunicationCreate |
	VMCommunicationSelfDestruct |
	VMCommunicationLog |
	VMCommunicationCall |
	VMCommunicationCallCode |
	VMCommunicationCallDelegate |
	VMCommunicationCallStatic;

export interface VMExecParam {
	stateStore: StateStore;
	channel: BaseModuleChannel;
	reducerHandler: ReducerHandler;
	// running smart contract code
	code: Buffer;
	// input to the smart contract
	input: Buffer;
	// transaction sender
	origin: Buffer;
	originNonce: bigint;
	// origin or previous smart contract address
	caller: Buffer;
	// smart contract address
	callee: Buffer;
	// remaining amount that can bee used (tx amount - fee)
	balance: bigint;
	// gas limit
	gasLimit: bigint;
	gasPrice: number;
	immutable?: boolean;
}

export interface VMWorkerData {
	sharedBuffer: SharedArrayBuffer;
	code: Buffer;
	input: Buffer;
	caller: Buffer;
	callee: Buffer;
	origin: Buffer;
	lastBlockTimestamp: number;
	lastBlockHeight: number;
	generatorAddress: Buffer;
	gasLimit: bigint;
	gasPrice: number;
	balance: bigint;
	immutable?: boolean;
}

export interface BaseModuleChannel {
	publish(name: string, data?: Record<string, unknown>): void;
}
