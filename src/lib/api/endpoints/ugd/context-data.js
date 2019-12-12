'use strict';
const { Models } = require('@nti/lib-interfaces');
const { PageInfo } = Models.content;


class GetContextData {
	constructor (config) {}

	handle (req, res, error) {
		const {ntiidObject, ntiService} = req;

		const container = ntiidObject.getContainerID();

		ntiService.getObject(container)
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

function register (api, config,) {
	const handler = new GetContextData(config);
	api.get('/ugd/context-data/:ntiid', (req, res, error) => handler.handle(req, res, error));
}


Object.assign(exports, {
	default: register,
	GetContextData
});
