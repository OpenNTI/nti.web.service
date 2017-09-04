'use strict';
const path = require('path');

exports = module.exports = {

	register (/*expressApp , config, requestRestart*/) {

		return {
			devmode: null,

			assets: path.join(__dirname, 'assets'),

			renderContent ({config, html}) {
				return `Page! at ${config.basepath}\n${JSON.stringify(config, void 0, 4)}`;
			}
		};

	}

};
