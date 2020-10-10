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
import * as fs from 'fs-extra';
import { ApplicationConfig, utils } from 'lisk-sdk';
import {
	getDefaultPath,
	splitPath,
	getConfigDirs,
	getNetworkConfigFilesPath,
} from '../../utils/path';
import { flags as commonFlags } from '../../utils/flags';

export default class ShowCommand extends Command {
	static description = 'Show application config.';

	static examples = ['config:show', 'config:show --config ./custom-config.json --data-path ./data'];

	static flags = {
		'data-path': flagParser.string({
			...commonFlags.dataPath,
			env: 'LISK_DATA_PATH',
		}),
		config: flagParser.string({
			char: 'c',
			description:
				'File path to a custom config. Environment variable "LISK_CONFIG_FILE" can also be used.',
			env: 'LISK_CONFIG_FILE',
		}),
		pretty: flagParser.boolean({
			description: 'Prints JSON in pretty format rather than condensed.',
		}),
	};

	async run(): Promise<void> {
		const { flags } = this.parse(ShowCommand);
		const dataPath = flags['data-path'] ? flags['data-path'] : getDefaultPath();
		const pathConfig = splitPath(dataPath);

		// Validate dataPath/config if config for other network exists, throw error and exit unless overwrite-config is specified
		const configDir = getConfigDirs(dataPath);
		// If config file exist, do not copy unless overwrite-config is specified
		if (configDir.length !== 1) {
			this.error(`Folder in ${dataPath} does not contain valid config`);
		}
		// If genesis block file exist, do not copy unless overwrite-config is specified
		const network = configDir[0];

		// Read network genesis block and config from the folder
		const { configFilePath } = getNetworkConfigFilesPath(dataPath, network);
		// Get config from network config or config specified
		let config = await fs.readJSON(configFilePath);

		if (flags.config) {
			const customConfig: ApplicationConfig = await fs.readJSON(flags.config);
			config = utils.objects.mergeDeep({}, config, customConfig) as ApplicationConfig;
		}

		config.rootPath = pathConfig.rootPath;
		config.label = pathConfig.label;
		config.version = this.config.pjson.version;

		if (flags.pretty) {
			this.log(JSON.stringify(config, undefined, '  '));
		} else {
			this.log(JSON.stringify(config));
		}
	}
}
