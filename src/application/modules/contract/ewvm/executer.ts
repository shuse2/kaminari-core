import { parentPort, isMainThread, workerData } from 'worker_threads';
import { SyncCalls } from '../sync-calls';
import { VMCommunicationExecuted, VMWorkerData } from '../types';
import { RESULT_STATUS_FAILURE } from './constants';
import { Env } from './env';

if (isMainThread) {
	throw new Error('it should not run on main thread');
}
if (parentPort === null) {
	throw new Error('Parent port is not open');
}

const channel = parentPort;
const {
	sharedBuffer,
	callee,
	caller,
	code,
	origin,
	balance,
	gasLimit,
	gasPrice,
	generatorAddress,
	input,
	lastBlockHeight,
	lastBlockTimestamp,
	immutable,
} = workerData as VMWorkerData;

const syncCalls = new SyncCalls(sharedBuffer);

const env = new Env({
	syncCalls,
	messagePort: channel,
	callee,
	code,
	caller,
	origin,
	balance,
	gasLimit,
	gasPrice,
	generatorAddress,
	input,
	lastBlockHeight,
	lastBlockTimestamp,
	immutable,
});

const execute = async (): Promise<void> => {
	const lib = await WebAssembly.instantiate(new Uint8Array(code), { ethereum: env.exports });
	const exported = lib.instance.exports;
	const memory = exported.memory as WebAssembly.Memory;
	env.setMemory(memory.buffer as SharedArrayBuffer);
	if (typeof exported.main !== 'function') {
		throw new Error('main function is not exported');
	}
	exported.main();
};

execute().then(() => {
	channel.postMessage({ action: 'executed', usedGas: env.usedGas, resultData: env.output, resultStatus: env.resultStatus } as VMCommunicationExecuted);
}).catch(() => {
	channel.postMessage({ action: 'executed', usedGas: env.usedGas, resultData: env.output, resultStatus: RESULT_STATUS_FAILURE } as VMCommunicationExecuted);
});
