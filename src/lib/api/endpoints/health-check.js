'use strict';
const {SERVER_REF} = require('../../constants');

exports.default = function register (api, config, routeFactory) {

	api.get(/^\/_ops\/ping-through/, async (SERVER_CONTEXT, res) => {
		let status = 204;

		try {
			await SERVER_CONTEXT[SERVER_REF].get('/_ops/ping', SERVER_CONTEXT);
		}
		catch (e) {
			status = 503;
		}

		res.status(status);
		res.end();
	});

	api.get(/^\/_ops\/ping/, (_, res) => {
		res.status(204);
		res.end();
	});
};
