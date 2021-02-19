/* eslint-disable class-methods-use-this */
import { ApplyAssetContext, BaseAsset, ValidateAssetContext } from 'lisk-sdk';
import { createContract, getContractAddress } from '../data_access/contract';
import { VM } from '../ewvm';
import { BaseModuleChannel } from '../types';

interface Asset {
	amount: bigint;
	data: Buffer;
	gasLimit: bigint;
	gasPrice: number;
}

export class DeployAsset extends BaseAsset {
	public id = 0;
	public name = 'deploy';
	public schema = {
		$id: 'kaminari/contract/deploy',
		type: 'object',
		properties: {
			amount: {
				fieldNumber: 1,
				dataType: 'uint64',
			},
			data: {
				fieldNumber: 2,
				dataType: 'bytes',
			},
			gasLimit: {
				fieldNumber: 3,
				dataType: 'uint64',
			},
			gasPrice: {
				fieldNumber: 4,
				dataType: 'uint32',
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
		// inject gas measurement code
		const address = getContractAddress(context.transaction.senderAddress, context.transaction.nonce);
		// store contract
		await context.reducerHandler.invoke('token:debit', { address: context.transaction.senderAddress, amount: context.asset.amount });
		const vm = new VM();
		const result = await vm.execute({
			balance: BigInt(0),
			callee: address,
			caller: context.transaction.senderAddress,
			origin: context.transaction.senderAddress,
			originNonce: context.transaction.nonce,
			code: context.asset.data,
			channel: this._channel,
			gasLimit: context.asset.gasLimit,
			gasPrice: context.asset.gasPrice,
			input: Buffer.alloc(0),
			reducerHandler: context.reducerHandler,
			stateStore: context.stateStore,
		});
		await createContract(context.stateStore, context.transaction.senderAddress, context.transaction.nonce, context.transaction.senderAddress, context.asset.amount, Buffer.from(result.resultData));
	}
}
