'use strict';

exports = module.exports = {

	register (/*expressApp*/) {

		return {
			devmode: null,

			assets: __dirname,

			render (base, req, config) {
				return 'Page! at ' + base + config.html;
			}
		};

	}

};
