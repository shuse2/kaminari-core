import { parentPort, isMainThread } from 'worker_threads';

if (isMainThread) {
	throw new Error('it should not run on main thread');
}
if (parentPort === null) {
	throw new Error('Parent port is not open');
}

const abort = msg => {
	console.log('abort', msg)
	throw new Error(msg);
}

const print32 = val => {
	console.log('print', val);
}

const loadPreStateRoot = (sharedArray, ptr) => {
	Atomics.compareExchange(sharedArray, 0, unlocked, locked);
	parentPort.postMessage({ action: 'query' });
	Atomics.wait(sharedArray, 0, locked);
}

let active = false;

parentPort.on('message', async (message: Record<string, unknown>) => {
	const { action } = message;
	if (action === 'execute') {
		if (active) {
			console.log('currently active')
			return;
		}
		active = true;
		const { code, memory, sharedArray } = message;
		console.log('starting')
		const lib = await WebAssembly.instantiate(new Uint8Array(code), { env: { abort, print32, loadPreStateRoot: ptr => loadPreStateRoot(sharedArray, ptr) } });
		const func = lib.instance.exports;
		func.main();
		console.log('done')
		parentPort.postMessage({ action: 'executed', memory: func.memory.buffer });
		active = false;
	}
});
