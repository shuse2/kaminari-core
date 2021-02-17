const RESULT_INIT = 0;
const RESULT_OK = 1;
const RESULT_ERR = 2;
const RESULT_SIZE = 4;
const RESULT_TYPE_SIZE = 4;
const BUFFER_OFFSET = RESULT_SIZE + RESULT_TYPE_SIZE;
const RESULT_TYPE_INDEX = 0;
const RESULT_SIZE_INDEX = 1;

export class SyncCalls {
	private readonly _sharedBuffer: SharedArrayBuffer;
	private _data: Int32Array;

	constructor(sharedBuffer?: SharedArrayBuffer, size = 64 * 1024) {
		this._sharedBuffer = sharedBuffer ?? new SharedArrayBuffer(size);
		this._data = new Int32Array(this._sharedBuffer);
	}

	public get sharedBuffer(): SharedArrayBuffer {
		return this._sharedBuffer;
	}

	public syncCall(fn: () => void): Buffer | undefined {
		fn();
		// set to block
		Atomics.store(this._data, RESULT_TYPE_INDEX, RESULT_INIT);
		Atomics.store(this._data, RESULT_SIZE_INDEX, 0);
		Atomics.wait(this._data, RESULT_TYPE_INDEX, RESULT_INIT);
		const [resultType, length] = this._data;
		if (resultType === RESULT_OK && length === 0) {
			return undefined;
		}
		const data = Buffer.from(this._sharedBuffer, BUFFER_OFFSET, length);
		if (resultType === RESULT_OK) {
			return data;
		}
		throw new Error(data.toString('utf8'));
	}

	public async handleSyncCall(fn: () => Promise<Buffer | undefined>): Promise<void> {
		let result: Buffer | undefined;
		let type = 0;
		let length = 0;
		try {
			result = await fn();
			if (result) {
				result.copy(Buffer.from(this._sharedBuffer), BUFFER_OFFSET);
				this._data = new Int32Array(this._sharedBuffer);
			}
			type = RESULT_OK;
			length = result ? result.length : 0;
		} catch (err) {
			type = RESULT_ERR;
			result = Buffer.from(typeof (err as Error).message === 'string' ? (err as Error).message : 'Invalid Function call', 'utf8');
			length = result.length;
		}
		Atomics.store(this._data, RESULT_TYPE_INDEX, type);
		Atomics.store(this._data, RESULT_SIZE_INDEX, length);
		Atomics.notify(this._data, RESULT_TYPE_INDEX, 1);
	}
}
