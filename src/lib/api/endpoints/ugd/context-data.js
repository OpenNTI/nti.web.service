'use strict';

class GetContextData {
	async getPageInfoModel() {
		if (!this.PageInfo) {
			const {
				Models: {
					content: { PageInfo },
				},
			} = await import('@nti/lib-interfaces');
			this.PageInfo = PageInfo;
		}
		return this.PageInfo;
	}

	async handle(req, res, error) {
		const { ntiidObject, ntiService } = req;

		try {
			const PageInfo = await this.getPageInfoModel();
			const container = ntiidObject.getContainerID();

			let obj = await ntiService.getObject(container);
			if (obj instanceof PageInfo) {
				obj = await this.getContext(req, obj);
			}

			await res.json(obj);
		} catch (e) {
			error(e);
		}
	}

	getContext(req, pageInfo) {
		// const ntiidObject = req.ntiidObject;
		// const applicableRange = ntiidObject.applicableRange;

		return pageInfo.getContent().then(html => {
			return { html };
		});
	}
}

function register(api, config, routeFactory) {
	const handler = new GetContextData(config);
	api.get('/ugd/context-data/:ntiid', (req, res, error) =>
		handler.handle(req, res, error)
	);
}

Object.assign(exports, {
	default: register,
	GetContextData,
});
