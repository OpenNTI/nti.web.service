'use strict';

exports = module.exports = {

	register (/*expressApp , config, requestRestart*/) {

		return {
			devmode: null,

			assets: __dirname,

			render (base, req, clientConfig) {
				return 'Page! at ' + base + clientConfig.html;
			}
		};

	}

};
