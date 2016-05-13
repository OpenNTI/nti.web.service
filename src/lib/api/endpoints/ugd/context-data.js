'use strict';
const getModel = require('nti-lib-interfaces').getModel;
const PageInfo = getModel('pageinfo');

class GetContextData {
	constructor (config, server) {
		this.server = server;
	}

	handle (req, res, error) {
		const ntiidObject = req.ntiidObject;

		const container = ntiidObject.getContainerID();

		req.ntiService.getParsedObject(container)
			.then(obj => obj instanceof PageInfo ? this.getContext(req, obj) : obj)
			.then(o => res.json(o))
			.catch(error);
	}



	getContext (req, pageInfo) {
		// const ntiidObject = req.ntiidObject;
		// const applicableRange = ntiidObject.applicableRange;

		return pageInfo.getContent()
			.then(html => {

				return {html};
			});
	}
}


module.exports = function register (api, config, dataserver) {
	const handler = new GetContextData(config, dataserver);
	api.get('/ugd/context-data/:ntiid', (req, res, error) => handler.handle(req, res, error));
};
