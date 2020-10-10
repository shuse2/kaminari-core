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
import { Command } from '@oclif/command';
import { symlinkSync, pathExistsSync, removeSync } from 'fs-extra';
import { join } from 'path';

export default class LinkCommand extends Command {
	static description = 'Symlink specific SDK folder during development.';

	static examples = ['sdk:link /sdk/location/'];

	static args = [
		{ name: 'targetSDKFolder', required: true, description: 'The path to the lisk SDK folder' },
	];

	// eslint-disable-next-line class-methods-use-this, @typescript-eslint/require-await
	async run(): Promise<void> {
		const {
			args: { targetSDKFolder },
		} = this.parse(LinkCommand);

		if (!pathExistsSync(targetSDKFolder)) {
			throw new Error(`Path '${targetSDKFolder as string}' does not exist or no access allowed`);
		}

		const sdkLocalPath = join(__dirname, '../../../', 'node_modules', 'lisk-sdk');

		removeSync(sdkLocalPath);
		symlinkSync(targetSDKFolder, sdkLocalPath);
		this.log(`Linked '${targetSDKFolder as string}' to '${sdkLocalPath}'`);
	}
}
