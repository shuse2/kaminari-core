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
import { Command, flags as flagParser } from '@oclif/command';
import * as fs from 'fs-extra';
import { ApplicationConfig, utils, HTTPAPIPlugin, ForgerPlugin } from 'lisk-sdk';
import {
	getDefaultPath,
	splitPath,
	getFullPath,
	getConfigDirs,
	removeConfigDir,
	ensureConfigDir,
	getDefaultConfigDir,
	getNetworkConfigFilesPath,
	getDefaultNetworkConfigFilesPath,
} from '../utils/path';
import { flags as commonFlags } from '../utils/flags';
import { getApplication } from '../application';
import { DEFAULT_NETWORK } from '../constants';

const LOG_OPTIONS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

export default class StartCommand extends Command {
	static description = 'Start Lisk Core Node.';

	static examples = ['start', 'start --network dev --data-path ./data --log debug'];

	static flags = {
		'data-path': flagParser.string({
			...commonFlags.dataPath,
			env: 'LISK_DATA_PATH',
		}),
		network: flagParser.string({
			...commonFlags.network,
			env: 'LISK_NETWORK',
			default: DEFAULT_NETWORK,
		}),
		config: flagParser.string({
			char: 'c',
			description:
				'File path to a custom config. Environment variable "LISK_CONFIG_FILE" can also be used.',
			env: 'LISK_CONFIG_FILE',
		}),
		'overwrite-config': flagParser.boolean({
			description: 'Overwrite network configs if they exist already',
			default: false,
		}),
		port: flagParser.integer({
			char: 'p',
			description:
				'Open port for the peer to peer incoming connections. Environment variable "LISK_PORT" can also be used.',
			env: 'LISK_PORT',
		}),
		'enable-ipc': flagParser.boolean({
			description:
				'Enable IPC communication. This will also load up plugins in child process and communicate over IPC.',
			default: false,
		}),
		'console-log': flagParser.string({
			description:
				'Console log level. Environment variable "LISK_CONSOLE_LOG_LEVEL" can also be used.',
			env: 'LISK_CONSOLE_LOG_LEVEL',
			options: LOG_OPTIONS,
		}),
		log: flagParser.string({
			char: 'l',
			description: 'File log level. Environment variable "LISK_FILE_LOG_LEVEL" can also be used.',
			env: 'LISK_FILE_LOG_LEVEL',
			options: LOG_OPTIONS,
		}),
		'seed-peers': flagParser.string({
			env: 'LISK_SEED_PEERS',
			description:
				'Seed peers to initially connect to in format of comma separated "ip:port". IP can be DNS name or IPV4 format. Environment variable "LISK_SEED_PEERS" can also be used.',
		}),
		'enable-http-api-plugin': flagParser.boolean({
			description:
				'Enable HTTP API Plugin. Environment variable "LISK_ENABLE_HTTP_API_PLUGIN" can also be used.',
			env: 'LISK_ENABLE_HTTP_API_PLUGIN',
			default: false,
		}),
		'http-api-plugin-port': flagParser.integer({
			description:
				'Port to be used for HTTP API Plugin. Environment variable "LISK_HTTP_API_PLUGIN_PORT" can also be used.',
			env: 'LISK_HTTP_API_PLUGIN_PORT',
			dependsOn: ['enable-http-api-plugin'],
		}),
		'http-api-plugin-whitelist': flagParser.string({
			description:
				'List of IPs in comma separated value to allow the connection. Environment variable "LISK_HTTP_API_PLUGIN_WHITELIST" can also be used.',
			env: 'LISK_HTTP_API_PLUGIN_WHITELIST',
			dependsOn: ['enable-http-api-plugin'],
		}),
		'enable-forger-plugin': flagParser.boolean({
			description:
				'Enable Forger Plugin. Environment variable "LISK_ENABLE_FORGER_PLUGIN" can also be used.',
			env: 'LISK_ENABLE_FORGER_PLUGIN',
			default: false,
		}),
		'forger-plugin-port': flagParser.integer({
			description:
				'Port to be used for Forger Plugin. Environment variable "LISK_FORGER_PLUGIN_PORT" can also be used.',
			env: 'LISK_FORGER_PLUGIN_PORT',
			dependsOn: ['enable-forger-plugin'],
		}),
		'forger-plugin-whitelist': flagParser.string({
			description:
				'List of IPs in comma separated value to allow the connection. Environment variable "LISK_FORGER_PLUGIN_WHITELIST" can also be used.',
			env: 'LISK_FORGER_PLUGIN_WHITELIST',
			dependsOn: ['enable-forger-plugin'],
		}),
		'enable-stress': flagParser.boolean({
			description: 'Enable Stress Plugin.',
			default: false,
		}),
	};

	// eslint-disable-next-line @typescript-eslint/require-await
	async run(): Promise<void> {
		const { flags } = this.parse(StartCommand);
		const dataPath = flags['data-path'] ? flags['data-path'] : getDefaultPath();
		this.log(`Starting Lisk Core at ${getFullPath(dataPath)}`);
		const pathConfig = splitPath(dataPath);

		const defaultNetworkConfigs = getDefaultConfigDir();
		const defaultNetworkConfigDir = getConfigDirs(defaultNetworkConfigs);
		if (!defaultNetworkConfigDir.includes(flags.network)) {
			this.error(
				`Network must be one of ${defaultNetworkConfigDir.join(',')} but received ${flags.network}`,
			);
		}

		// Validate dataPath/config if config for other network exists, throw error and exit unless overwrite-config is specified
		const configDir = getConfigDirs(dataPath);
		// If config file exist, do not copy unless overwrite-config is specified
		if (configDir.length > 1 || (configDir.length === 1 && configDir[0] !== flags.network)) {
			if (!flags['overwrite-config']) {
				this.error(
					`Datapath ${dataPath} already contains configs for ${configDir.join(
						',',
					)}. Please use --overwrite-config to overwrite the config`,
				);
			}
			// Remove other network configs
			for (const configFolder of configDir) {
				if (configFolder !== flags.network) {
					removeConfigDir(dataPath, configFolder);
				}
			}
		}
		// If genesis block file exist, do not copy unless overwrite-config is specified
		ensureConfigDir(dataPath, flags.network);

		// Read network genesis block and config from the folder
		const { genesisBlockFilePath, configFilePath } = getNetworkConfigFilesPath(
			dataPath,
			flags.network,
		);
		const {
			genesisBlockFilePath: defaultGenesisBlockFilePath,
			configFilePath: defaultConfigFilepath,
		} = getDefaultNetworkConfigFilesPath(flags.network);
		if (
			!fs.existsSync(genesisBlockFilePath) ||
			(fs.existsSync(genesisBlockFilePath) && flags['overwrite-config'])
		) {
			fs.copyFileSync(defaultGenesisBlockFilePath, genesisBlockFilePath);
		}
		if (
			!fs.existsSync(configFilePath) ||
			(fs.existsSync(configFilePath) && flags['overwrite-config'])
		) {
			fs.copyFileSync(defaultConfigFilepath, configFilePath);
		}

		// Get config from network config or config specified
		const genesisBlock = await fs.readJSON(genesisBlockFilePath);
		let config = await fs.readJSON(configFilePath);

		if (flags.config) {
			const customConfig: ApplicationConfig = await fs.readJSON(flags.config);
			config = utils.objects.mergeDeep({}, config, customConfig) as ApplicationConfig;
		}

		config.rootPath = pathConfig.rootPath;
		config.label = pathConfig.label;
		config.version = this.config.pjson.version;
		// Inject other properties specified
		if (flags['enable-ipc']) {
			config.ipc = { enabled: flags['enable-ipc'] };
		}
		if (flags['console-log']) {
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			config.logger = config.logger ?? {};
			config.logger.consoleLogLevel = flags['console-log'];
		}
		if (flags.log) {
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			config.logger = config.logger ?? {};
			config.logger.fileLogLevel = flags.log;
		}
		if (flags.port) {
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			config.network = config.network ?? {};
			config.network.port = flags.port;
		}
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (flags['seed-peers']) {
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			config.network = config.network ?? {};
			config.network.seedPeers = [];
			const peers = flags['seed-peers'].split(',');
			for (const seed of peers) {
				const [ip, port] = seed.split(':');
				if (!ip || !port || Number.isNaN(Number(port))) {
					this.error('Invalid ip or port is specified.');
				}
				config.network.seedPeers.push({ ip, port: Number(port) });
			}
		}
		// Plugin configs
		if (flags['http-api-plugin-port'] !== undefined) {
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			config.plugins[HTTPAPIPlugin.alias] = config.plugins[HTTPAPIPlugin.alias] ?? {};
			config.plugins[HTTPAPIPlugin.alias].port = flags['http-api-plugin-port'];
		}
		if (flags['http-api-plugin-whitelist'] !== undefined) {
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			config.plugins[HTTPAPIPlugin.alias] = config.plugins[HTTPAPIPlugin.alias] ?? {};
			config.plugins[HTTPAPIPlugin.alias].whiteList = flags['http-api-plugin-whitelist'].split(',');
		}
		if (flags['forger-plugin-port'] !== undefined) {
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			config.plugins[ForgerPlugin.alias] = config.plugins[ForgerPlugin.alias] ?? {};
			config.plugins[ForgerPlugin.alias].port = flags['forger-plugin-port'];
		}
		if (flags['forger-plugin-whitelist'] !== undefined) {
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			config.plugins[ForgerPlugin.alias] = config.plugins[ForgerPlugin.alias] ?? {};
			config.plugins[ForgerPlugin.alias].whiteList = flags['forger-plugin-whitelist'].split(',');
		}
		// Get application and start
		try {
			const app = getApplication(genesisBlock, config, {
				enableHTTPAPIPlugin: flags['enable-http-api-plugin'],
				enableForgerPlugin: flags['enable-forger-plugin'],
				enableStress: flags['enable-stress'],
			});
			await app.run();
		} catch (errors) {
			this.error(
				Array.isArray(errors) ? errors.map(err => (err as Error).message).join(',') : errors,
			);
		}
	}
}
