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

import { Command, flags as flagParser } from '@oclif/command';
import { codec, cryptography, IPCChannel, RegisteredSchema } from 'lisk-sdk';
import { getDefaultPath, getSocketsPath, splitPath, getGenesisBlockAndConfig } from './utils/path';
import { flags as commonFlags } from './utils/flags';
import { isApplicationRunning } from './utils/application';
import { getApplication } from './application';
import { DEFAULT_NETWORK } from './constants';

interface BaseIPCFlags {
	readonly 'data-path'?: string;
	readonly network: string;
	readonly offline?: boolean;
	readonly pretty?: boolean;
}

export interface Schema {
	readonly $id: string;
	readonly type: string;
	readonly properties: Record<string, unknown>;
}

export interface Codec {
	decodeAccount: (data: Buffer | string) => Record<string, unknown>;
	decodeBlock: (data: Buffer | string) => Record<string, unknown>;
	decodeTransaction: (data: Buffer | string) => Record<string, unknown>;
	encodeTransaction: (assetSchema: Schema, transactionObject: Record<string, unknown>) => string;
	transactionFromJSON: (
		assetSchema: Schema,
		transactionObject: Record<string, unknown>,
	) => Record<string, unknown>;
	transactionToJSON: (
		assetSchema: Schema,
		transactionObject: Record<string, unknown>,
	) => Record<string, unknown>;
}

const prettyDescription = 'Prints JSON in pretty format rather than condensed.';

const convertStrToBuffer = (data: Buffer | string): Buffer =>
	Buffer.isBuffer(data) ? data : Buffer.from(data, 'hex');

export default abstract class BaseIPCCommand extends Command {
	static flags = {
		pretty: flagParser.boolean({
			description: prettyDescription,
		}),
		'data-path': flagParser.string({
			...commonFlags.dataPath,
			env: 'LISK_DATA_PATH',
		}),
		offline: flagParser.boolean({
			...commonFlags.offline,
			default: false,
			hidden: true,
		}),
		network: flagParser.string({
			...commonFlags.network,
			env: 'LISK_NETWORK',
			default: DEFAULT_NETWORK,
			hidden: true,
		}),
	};

	public baseIPCFlags!: BaseIPCFlags;
	protected _codec!: Codec;
	protected _channel!: IPCChannel;
	protected _schema!: RegisteredSchema;

	// eslint-disable-next-line @typescript-eslint/require-await
	async finally(error?: Error | string): Promise<void> {
		if (error) {
			// TODO: replace this logic with isApplicationRunning util and log the error accordingly
			if (/^IPC Socket client connection timeout./.test((error as Error).message)) {
				this.error(
					'Please ensure the app is up and running with ipc enabled before using the command!',
				);
			}
			this.error(error instanceof Error ? error.message : error);
		}
		if (!this.baseIPCFlags.offline) {
			this._channel.cleanup();
		}
	}

	async init(): Promise<void> {
		const { flags } = this.parse(this.constructor as typeof BaseIPCCommand);
		this.baseIPCFlags = flags;
		const dataPath = this.baseIPCFlags['data-path']
			? this.baseIPCFlags['data-path']
			: getDefaultPath();

		if (this.baseIPCFlags.offline) {
			// Read network genesis block and config from the folder
			const { genesisBlock, config } = await getGenesisBlockAndConfig(this.baseIPCFlags.network);
			const app = getApplication(genesisBlock, config, {
				enableHTTPAPIPlugin: false,
				enableForgerPlugin: false,
			});
			this._schema = app.getSchema();
		} else {
			await this._createIPCChannel(dataPath);
			this._schema = await this._channel.invoke('app:getSchema');
		}
		this._setCodec();
	}

	printJSON(message?: string | Record<string, unknown>): void {
		if (this.baseIPCFlags.pretty) {
			this.log(JSON.stringify(message, undefined, '  '));
		} else {
			this.log(JSON.stringify(message));
		}
	}

	private async _createIPCChannel(dataPath: string): Promise<void> {
		const { rootPath, label } = splitPath(dataPath);

		if (!isApplicationRunning(dataPath)) {
			throw new Error(`Application at data path ${dataPath} is not running.`);
		}

		this._channel = new IPCChannel(
			'CoreCLI',
			[],
			{},
			{
				socketsPath: getSocketsPath(rootPath, label),
			},
		);

		await this._channel.startAndListen();
	}

	private _setCodec(): void {
		this._codec = {
			decodeAccount: (data: Buffer | string): Record<string, unknown> =>
				codec.decodeJSON<Record<string, unknown>>(this._schema.account, convertStrToBuffer(data)),
			decodeBlock: (data: Buffer | string): Record<string, unknown> => {
				const blockBuffer: Buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'hex');
				const {
					header,
					payload,
				}: {
					header: Buffer;
					payload: ReadonlyArray<Buffer>;
				} = codec.decode(this._schema.block, blockBuffer);

				const baseHeaderJSON: {
					asset: string;
					version: string;
				} = codec.decodeJSON(this._schema.blockHeader, header);
				const blockAssetJSON = codec.decodeJSON<Record<string, unknown>>(
					this._schema.blockHeadersAssets[baseHeaderJSON.version],
					Buffer.from(baseHeaderJSON.asset, 'hex'),
				);
				const payloadJSON = payload.map(transactionBuffer =>
					this._codec.decodeTransaction(transactionBuffer),
				);

				const blockId = cryptography.hash(header).toString('hex');

				return {
					header: {
						...baseHeaderJSON,
						asset: { ...blockAssetJSON },
						id: blockId,
					},
					payload: payloadJSON,
				};
			},
			decodeTransaction: (data: Buffer | string): Record<string, unknown> => {
				const transactionBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'hex');
				const baseTransaction: {
					moduleID: number;
					assetID: number;
					asset: string;
				} = codec.decodeJSON(this._schema.transaction, transactionBuffer);
				const transactionTypeAssetSchema = this._schema.transactionsAssets.find(
					as => as.moduleID === baseTransaction.moduleID && as.assetID === baseTransaction.assetID,
				);
				if (!transactionTypeAssetSchema) {
					throw new Error(
						`Transaction with module ${baseTransaction.moduleID} asset ${baseTransaction.assetID} is not registered`,
					);
				}
				const transactionAsset = codec.decodeJSON<Record<string, unknown>>(
					transactionTypeAssetSchema.schema,
					Buffer.from(baseTransaction.asset, 'hex'),
				);

				return {
					...baseTransaction,
					id: cryptography.hash(transactionBuffer).toString('hex'),
					asset: transactionAsset,
				};
			},
			transactionFromJSON: (
				assetSchema: Schema,
				transactionObject: Record<string, unknown>,
			): Record<string, unknown> => {
				const assetBuffer = codec.encode(
					assetSchema,
					codec.fromJSON(assetSchema, transactionObject.asset as object),
				);

				return codec.fromJSON(this._schema.transaction, {
					...transactionObject,
					asset: assetBuffer,
				});
			},
			transactionToJSON: (
				assetSchema: Schema,
				transactionObject: Record<string, unknown>,
			): Record<string, unknown> => {
				const assetJSON = codec.toJSON(assetSchema, transactionObject.asset as object);

				const transactionJSON = codec.toJSON(this._schema.transaction, {
					...transactionObject,
					asset: Buffer.alloc(0),
				});

				return {
					...transactionJSON,
					asset: assetJSON,
				};
			},
			encodeTransaction: (
				assetSchema: Schema,
				transactionObject: Record<string, unknown>,
			): string => {
				const assetBuffer = codec.encode(assetSchema, transactionObject.asset as object);

				const transactionBuffer = codec.encode(this._schema.transaction, {
					...transactionObject,
					asset: assetBuffer,
				});

				return transactionBuffer.toString('hex');
			},
		};
	}
}
