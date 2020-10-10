/*
 * Copyright © 2020 Lisk Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the Lisk Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 *
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { flags as flagParser } from '@oclif/command';
import { codec, cryptography, transactions, validator } from 'lisk-sdk';
import BaseIPCCommand from '../../base_ipc';
import { flags as commonFlags } from '../../utils/flags';
import { getAssetFromPrompt, getPassphraseFromPrompt } from '../../utils/reader';
import { DEFAULT_NETWORK } from '../../constants';

interface Args {
	readonly moduleID: number;
	readonly assetID: number;
	readonly fee: string;
}

export default class CreateCommand extends BaseIPCCommand {
	static strict = false;
	static description =
		'Create transaction which can be broadcasted to the network. Note: fee and amount should be in Beddows!!';

	static args = [
		{
			name: 'moduleID',
			required: true,
			description: 'Registered transaction module id.',
		},
		{
			name: 'assetID',
			required: true,
			description: 'Registered transaction asset id.',
		},
		{
			name: 'fee',
			required: true,
			description: 'Transaction fee in Beddows.',
		},
	];

	static examples = [
		'transaction:create 2 0 100000000 --asset=\'{"amount":100000000,"recipientAddress":"ab0041a7d3f7b2c290b5b834d46bdc7b7eb85815","data":"send token"}\'',
		'transaction:create 2 0 100000000 --offline --network mainnet --network-identifier 873da85a2cee70da631d90b0f17fada8c3ac9b83b2613f4ca5fddd374d1034b3 --nonce 1 --asset=\'{"amount":100000000,"recipientAddress":"ab0041a7d3f7b2c290b5b834d46bdc7b7eb85815","data":"send token"}\'',
	];

	static flags = {
		...BaseIPCCommand.flags,
		'network-identifier': flagParser.string(commonFlags.networkIdentifier),
		nonce: flagParser.string({
			description: 'Nonce of the transaction.',
		}),
		'no-signature': flagParser.boolean({
			description:
				'Creates the transaction without a signature. Your passphrase will therefore not be required',
		}),
		passphrase: flagParser.string(commonFlags.passphrase),
		'sender-publickey': flagParser.string({
			char: 's',
			description:
				'Creates the transaction with provided sender publickey, when passphrase is not provided',
		}),
		asset: flagParser.string({
			char: 'a',
			description: 'Creates transaction with specific asset information',
		}),
		json: flagParser.boolean({
			char: 'j',
			description: 'Print the transaction in JSON format',
		}),
		offline: flagParser.boolean({
			...commonFlags.offline,
			hidden: false,
			default: false,
		}),
		network: flagParser.string({
			...commonFlags.network,
			default: DEFAULT_NETWORK,
			hidden: false,
		}),
	};

	async run(): Promise<void> {
		const {
			args,
			flags: {
				'data-path': dataPath,
				passphrase: passphraseSource,
				'no-signature': noSignature,
				'sender-publickey': senderPublicKeySource,
				asset: assetSource,
				json,
				'network-identifier': networkIdentifierSource,
				nonce: nonceSource,
				offline,
			},
		} = this.parse(CreateCommand);
		const { fee, moduleID, assetID } = args as Args;

		if (offline && dataPath) {
			throw new Error(
				'Flag: --data-path should not be specified while creating transaction offline.',
			);
		}

		if (!senderPublicKeySource && noSignature) {
			throw new Error('Sender publickey must be specified when no-signature flags is used.');
		}

		if (offline && !networkIdentifierSource) {
			throw new Error(
				'Flag: --network-identifier must be specified while creating transaction offline.',
			);
		}

		if (offline && !nonceSource) {
			throw new Error('Flag: --nonce must be specified while creating transaction offline.');
		}

		const assetSchema = this._schema.transactionsAssets.find(
			as => as.moduleID === Number(moduleID) && as.assetID === Number(assetID),
		);

		if (!assetSchema) {
			throw new Error(
				`Transaction moduleID:${moduleID} with assetID:${assetID} is not registered in the application.`,
			);
		}

		const rawAsset = assetSource
			? JSON.parse(assetSource)
			: await getAssetFromPrompt(assetSchema.schema);
		const assetObject = codec.fromJSON(assetSchema.schema, rawAsset);

		const assetErrors = validator.validator.validate(assetSchema.schema, assetObject);
		if (assetErrors.length) {
			throw new validator.LiskValidationError([...assetErrors]);
		}

		let networkIdentifier = networkIdentifierSource as string;
		if (!offline) {
			const nodeInfo = await this._channel.invoke<Record<string, unknown>>('app:getNodeInfo');
			networkIdentifier = nodeInfo.networkIdentifier as string;
		}

		if (!offline && networkIdentifierSource && networkIdentifier !== networkIdentifierSource) {
			throw new Error(
				`Invalid networkIdentifier specified, actual: ${networkIdentifierSource}, expected: ${networkIdentifier}.`,
			);
		}

		const incompleteTransaction: Record<string, unknown> = {
			moduleID: Number(moduleID),
			assetID: Number(assetID),
			nonce: nonceSource,
			fee,
			senderPublicKey: senderPublicKeySource,
			asset: assetObject,
			signatures: [],
		};
		let passphrase = '';

		if (passphraseSource || !noSignature) {
			passphrase = passphraseSource ?? (await getPassphraseFromPrompt('passphrase', true));
			const { publicKey } = cryptography.getAddressAndPublicKeyFromPassphrase(passphrase);
			incompleteTransaction.senderPublicKey = publicKey.toString('hex');
		}

		if (!offline) {
			const address = cryptography.getAddressFromPublicKey(
				Buffer.from(incompleteTransaction.senderPublicKey as string, 'hex'),
			);
			const account = await this._channel.invoke<string>('app:getAccount', {
				address: address.toString('hex'),
			});

			const {
				sequence: { nonce },
			} = this._codec.decodeAccount(account) as { sequence: { nonce: string } };
			incompleteTransaction.nonce = nonce;
		}

		if (!offline && nonceSource && BigInt(incompleteTransaction.nonce) > BigInt(nonceSource)) {
			throw new Error(
				`Invalid nonce specified, actual: ${nonceSource}, expected: ${
					incompleteTransaction.nonce as string
				}`,
			);
		}

		const transactionObject = this._codec.transactionFromJSON(assetSchema.schema, {
			...incompleteTransaction,
		});

		const transactionErrors = validator.validator.validate(
			this._schema.transaction,
			transactionObject,
		);
		if (transactionErrors.length) {
			throw new validator.LiskValidationError([...transactionErrors]);
		}

		transactionObject.asset = assetObject;
		if (passphrase) {
			transactions.signTransaction(
				assetSchema.schema,
				transactionObject,
				Buffer.from(networkIdentifier, 'hex'),
				passphrase,
			);
		}

		if (json) {
			this.printJSON(this._codec.transactionToJSON(assetSchema.schema, transactionObject));
		} else {
			this.printJSON({
				transaction: this._codec.encodeTransaction(assetSchema.schema, transactionObject),
			});
		}
	}
}
