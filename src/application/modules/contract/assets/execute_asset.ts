/* eslint-disable class-methods-use-this */
import { ApplyAssetContext, BaseAsset, ValidateAssetContext } from 'lisk-sdk';

interface Asset {
	address: Buffer;
	input: Buffer;
	maxFee: bigint;
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
			maxFee: {
				fieldNumber: 3,
				dataType: 'uint64',
			},
		},
	};

	public validate(context: ValidateAssetContext<Asset>): void {
		// eslint-disable-next-line no-console
		console.log(context);
	}

	public async apply(context: ApplyAssetContext<Asset>): Promise<void> {
		await new Promise(resolve => setTimeout(resolve, 100));
		// eslint-disable-next-line no-console
		console.log(context);
	}
}
