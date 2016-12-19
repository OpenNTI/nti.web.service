'use strict';

exports = module.exports = {

	register (/*expressApp*/_, __, checkVersion) {

		checkVersion('~1.3.0');

		return {
			devmode: null,

			assets: __dirname,

			render (base, req, config) {
				return 'Page! at ' + base + config.html;
			}
		};

	}

};
