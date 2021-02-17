'use strict';
const path = require('path');

exports = module.exports = {
	register(/*expressApp , config, requestRestart*/) {
		return {
			devmode: null,

			assets: path.join(__dirname, 'assets'),

			renderContent(config, markError) {
				if (/missing$/.test(config.url)) {
					markError();
					return;
				}
				if (/explicit404$/.test(config.url)) {
					markError();
					return;
				}
				if (/500$/.test(config.url)) {
					markError(500);
					return 'App Error Page';
				}
				if (/throw$/.test(config.url)) {
					throw new Error('Oops');
				}

				return `Page! at ${config.basepath}\n${JSON.stringify(
					config,
					void 0,
					4
				)}`;
			},
		};
	},
};
