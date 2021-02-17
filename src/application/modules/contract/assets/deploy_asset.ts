/* eslint-disable class-methods-use-this */
import { ApplyAssetContext, BaseAsset, ValidateAssetContext } from 'lisk-sdk';
import { createContract } from '../data_access/contract';

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

	public validate(context: ValidateAssetContext<Asset>): void {
		// eslint-disable-next-line no-console
		console.log(context);
	}

	public async apply(context: ApplyAssetContext<Asset>): Promise<void> {
		// inject gas measurement code
		// const address = getContractAddress(context.transaction.senderAddress, context.transaction.nonce);
		// store contract
		await createContract(context.stateStore, context.transaction.senderAddress, context.transaction.nonce, context.transaction.senderAddress, context.asset.amount, context.asset.data);
		await context.reducerHandler.invoke('token:debit', { address: context.transaction.senderAddress, amount: context.asset.amount });
	}
}
