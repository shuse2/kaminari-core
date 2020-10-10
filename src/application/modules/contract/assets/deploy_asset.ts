/* eslint-disable class-methods-use-this */
import { ApplyAssetContext, BaseAsset, ValidateAssetContext } from 'lisk-sdk';

interface Asset {
	code: Buffer;
}

export class DeployAsset extends BaseAsset {
	public id = 0;
	public name = 'deploy';
	public schema = {
		$id: 'kaminari/contract/deploy',
		type: 'object',
		properties: {
			code: {
				fieldNumber: 1,
				dataType: 'bytes',
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
