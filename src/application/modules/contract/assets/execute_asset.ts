/* eslint-disable class-methods-use-this */
import { ApplyAssetContext, BaseAsset, ValidateAssetContext } from 'lisk-sdk';
import { getContract } from '../data_access/contract';
import { VM } from '../ewvm';
import { BaseModuleChannel } from '../types';

interface Asset {
	address: Buffer;
	amount: bigint;
	input: Buffer;
	gasLimit: bigint;
	gasPrice: number;
}

export class ExecuteAsset extends BaseAsset {
	public id = 1;
	public name = 'execute';
	public schema = {
		$id: 'kaminari/contract/execute',
		type: 'object',
		properties: {
			address: {
				fieldNumber: 1,
				dataType: 'bytes',
			},
			input: {
				fieldNumber: 2,
				dataType: 'bytes',
			},
			amount: {
				fieldNumber: 3,
				dataType: 'uint64',
			},
			gasLimit: {
				fieldNumber: 4,
				dataType: 'uint64',
			},
		},
	};
	private readonly _channel: BaseModuleChannel;

	constructor(channel: BaseModuleChannel) {
		super();
		this._channel = channel;
	}

	public validate(_context: ValidateAssetContext<Asset>): void {
		// eslint-disable-next-line no-console
	}

	public async apply(context: ApplyAssetContext<Asset>): Promise<void> {
		const vm = new VM();
		const contract = await getContract(context.stateStore, context.asset.address);
		const result = await vm.execute({
			balance: BigInt(0),
			callee: context.asset.address,
			caller: context.transaction.senderAddress,
			origin: context.transaction.senderAddress,
			originNonce: context.transaction.nonce,
			code: contract.code,
			channel: this._channel,
			gasLimit: context.asset.gasLimit,
			gasPrice: context.asset.gasPrice,
			input: context.asset.input,
			reducerHandler: context.reducerHandler,
			stateStore: context.stateStore,
		});
		// Console logging result since currently action do not have state store
		// eslint-disable-next-line no-console
		console.log(result);
	}
}
