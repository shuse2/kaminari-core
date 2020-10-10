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

import { BaseForgingCommand } from '../../base_forging';

export default class EnableForgingCommand extends BaseForgingCommand {
	static description = 'Enable forging for given delegate address.';

	static examples = [
		'forging:enable address',
		'forging:enable address --data-path ./data',
		'forging:enable address --data-path ./data --password your_password',
	];

	static flags = {
		...BaseForgingCommand.flags,
	};

	static args = [...BaseForgingCommand.args];

	async init(): Promise<void> {
		await super.init();
		this.forging = true;
	}
}
