'use strict';
const express = require('express');

const logger = require('../logger');

const endpoints = require('./endpoints');

module.exports = function registerEndPoints (app, config, dataserver) {
	const api = express();
	app.use(/^\/api/i, api);

	function getService (req) {
		return req.ntiService
			? Promise.resolve(req.ntiService)
			: dataserver.getServiceDocument(req)
				.then(service => req.ntiService = service);
	}

	//Make Service resolving middleware available on the api router for sub routers to install
	//We cannot just install it here, because some API endpoints should work anonymously.
	api.ServiceMiddleWare = (req, res, next) => getService(req).then(() => next(), next);

	api.param('ntiid', (req, res, next, id) => {
		getService(req)
			.then(service => service.getObject(id))
			.then(ob => {
				req.ntiidObject = ob;
				next();
			})
			.catch(next);
	});

	endpoints(api, config, dataserver);

	api.use((err, req, res, next) => {//eslint-disable-line no-unused-vars
		logger.error('API Error:\n\n%s\n\n', err.stack || err.body || JSON.stringify(err));
		res.status(500).json({stack: err.stack, message: err.message});
		res.end();
	});
};
