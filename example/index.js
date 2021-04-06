'use strict';
const { join } = require('path');

exports = module.exports = {
	async register(/*expressApp , config, requestRestart*/) {
		await import('./esm.mjs');
		return {
			devmode: null,

			assets: __dirname,

			renderContent({ html, url, basepath }) {
				return 'Page! at ' + join(basepath, url) + html;
			},
		};
	},
};
