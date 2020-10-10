const contractStateSchema = {
	$id: 'kaminari/contracts/state',
	type: 'object',
	properties: {
		code: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		memory: {
			dataType: 'bytes',
			fieldNumber: 2,
		},
	},
};
