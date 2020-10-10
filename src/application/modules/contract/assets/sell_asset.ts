/* eslint-disable class-methods-use-this */
import { ApplyAssetContext, BaseAsset, ValidateAssetContext } from 'lisk-sdk';

interface Asset {
	address: Buffer;
	minPrice: bigint;
}

export class SellAsset extends BaseAsset {
	public id = 0;
	public name = 'sell';
	public schema = {
		$id: 'kaminari/contract/sell',
		type: 'object',
		properties: {
			address: {
				fieldNumber: 1,
				dataType: 'bytes',
			},
			minPrice: {
				fieldNumber: 2,
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
