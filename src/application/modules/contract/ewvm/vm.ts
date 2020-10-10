import { Worker } from 'worker_threads';
import { utils } from 'lisk-sdk';

export class VM {
	private readonly _mutex: utils.jobHandlers.Mutex;
	private _worker!: Worker;

	constructor() {
		this._mutex = new utils.jobHandlers.Mutex();
	}

	start(): void {
		this._worker = new Worker('./vm');
	}

	async stop(): Promise<void> {
		await this._worker.terminate();
	}

	async execute(code: Buffer, input: Buffer): Promise<Buffer> {
		const result = Buffer.alloc(0);
		await this._mutex.runExclusive(async () => {
			await new Promise(resolve => setTimeout(resolve, 1000));
		});
		return result;
	}
}
