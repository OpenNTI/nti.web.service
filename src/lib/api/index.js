'use strict';
const {SERVER_REF} = require('../constants');
const logger = require('../logger');

const endpoints = require('./endpoints');

module.exports = function registerEndPoints (app, config, routeFactory) {
	const api = routeFactory(/^\/api/i, app);

	async function getService (req) {
		const {[SERVER_REF]: server} = req;
		let service = req.ntiService;
		if (!service) {
			service = await server.getServiceDocument(req);
			// eslint-disable-next-line require-atomic-updates
			req.ntiService = service;
		}
		return service;
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

	endpoints(api, config, routeFactory);

	api.use((err, req, res, next) => {//eslint-disable-line no-unused-vars
		if ((err.error || {}).type !== 'aborted') {
			logger.error('API Error (%s): \n\n%s\n\n', req.originalUrl || req.url, err.stack || err.body || JSON.stringify(err));
		}
		res.status(500).json(err);
		res.end();
	});
};
