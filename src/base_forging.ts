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

import * as inquirer from 'inquirer';
import { flags as flagParser } from '@oclif/command';

import { flags as commonFlags } from './utils/flags';
import BaseIPCCommand from './base_ipc';

interface Args {
	readonly address: string;
}

export class BaseForgingCommand extends BaseIPCCommand {
	static args = [
		{
			name: 'address',
			required: true,
			description: 'Address of an account in a base32 format.',
		},
	];

	static flags = {
		...BaseIPCCommand.flags,
		password: flagParser.string(commonFlags.password),
	};

	protected forging!: boolean;

	async run(): Promise<void> {
		const { args, flags } = this.parse(this.constructor as typeof BaseForgingCommand);
		const { address } = args as Args;
		let password;

		if (flags.password) {
			password = flags.password;
		} else {
			const answers = await inquirer.prompt([
				{
					type: 'password',
					message: 'Enter password to decrypt the encrypted passphrase: ',
					name: 'password',
					mask: '*',
				},
			]);
			password = answers.password;
		}

		try {
			const result = await this._channel.invoke<{ address: string; forging: boolean }>(
				'app:updateForgingStatus',
				{
					address,
					password,
					forging: this.forging,
				},
			);
			this.log('Forging status:');
			this.printJSON(result);
		} catch (error) {
			this.error(error);
		}
	}
}
