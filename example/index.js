'use strict';
const {join} = require('path');

exports = module.exports = {

	register (/*expressApp , config, requestRestart*/) {

		return {
			devmode: null,

			assets: __dirname,

			renderContent ({html, url, basepath}) {
				return 'Page! at ' + join(basepath, url) + html;
			}
		};

	}

};
