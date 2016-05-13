'use strict';

module.exports = function register (api, config, server) {

	api.get(/^\/_ops\/ping/, (SERVER_CONTEXT, res) => {

		server.get('/_ops/ping', SERVER_CONTEXT)
			.then(() => 200, () => 503)
			.then(status => {
				res.status(status); res.end();
			});
	});
};
