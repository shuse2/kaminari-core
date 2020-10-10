import { BaseModule, StateStore } from 'lisk-sdk';

export class ContractModule extends BaseModule {
	public id = 1111;
	public name = 'contract';
	public accountSchema = {
		type: 'object',
		properties: {
			contracts: {
				type: 'array',
				fieldNumber: 1,
				items: {
					address: {
						dataType: 'bytes',
						fieldNumber: 1,
					},
				},
			},
		},
		default: {
			contracts: [],
		},
	};

	public actions = {
		getCode: async (params: Record<string, unknown>): Promise<Buffer | undefined> => {
			const { address } = params;
			if (!address || !Buffer.isBuffer(address)) {
				throw new Error('');
			}
			return this._dataAccess.getChainState(`contracts:${address.toString('binary')}`);
		},
	}
}
