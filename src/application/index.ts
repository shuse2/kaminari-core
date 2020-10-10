/*
 * Copyright © 2019 Lisk Foundation
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
 */
import { Application, ApplicationConfig, HTTPAPIPlugin, ForgerPlugin } from 'lisk-sdk';

export interface Options {
	enableHTTPAPIPlugin: boolean;
	enableForgerPlugin: boolean;
}

// Temporally disable eslint
/* eslint-disable */
export const getApplication = (
	genesisBlock: Record<string, unknown>,
	config: ApplicationConfig,
	options: Options,
): Application => {
	const app = Application.defaultApplication(genesisBlock, config);

	if (options.enableHTTPAPIPlugin) {
		app.registerPlugin(HTTPAPIPlugin, { loadAsChildProcess: true });
	}
	if (options.enableForgerPlugin) {
		app.registerPlugin(ForgerPlugin, { loadAsChildProcess: true });
	}
	return app;
};
