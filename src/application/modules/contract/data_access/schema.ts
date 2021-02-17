export const contractAccountSchema = {
	$id: 'smart-contract/account',
	type: 'object',
	properties: {
		address: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		code: {
			dataType: 'bytes',
			fieldNumber: 2,
		},
		nonce: {
			dataType: 'uint64',
			fieldNumber: 3,
		},
		value: {
			dataType: 'uint64',
			fieldNumber: 4,
		},
		destructed: {
			dataType: 'boolean',
			fieldNumber: 5,
		},
	},
};

export interface ContractAccount {
	address: Buffer;
	code: Buffer;
	nonce: bigint;
	value: bigint;
	destructed?: boolean;
}
