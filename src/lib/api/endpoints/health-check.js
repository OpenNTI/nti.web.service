'use strict';

exports.default = function register (api, config, server) {

	api.get(/^\/_ops\/ping-through/, (SERVER_CONTEXT, res) => {
		server.get('/_ops/ping', SERVER_CONTEXT)
			.then(() => 200, () => 503)
			.then(status => {
				res.status(status); res.end();
			});
	});

	api.get(/^\/_ops\/ping/, (_, res) => {
		res.status(200);
		res.end();
	});
};
