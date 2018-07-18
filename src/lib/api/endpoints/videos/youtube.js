'use strict';
const url = require('url');

const { Models, Service } = require('@nti/lib-interfaces');
const { URL: {appendQueryParams} } = require('@nti/lib-commons');

const logger = require('../../../logger').get('videos:youtube');

const { MediaSourceFactory, MetaDataResolver } = Models.media;
const getSourceURL = id => 'https://www.youtube.com/embed/${id}';



exports.default = function register (api, config, server) {

	const DUMMY_SERVICE = {
		isService: Service,
		isServerSide: true,
		getConfig: () => config,
		getServer: () => server,
		getSiteName: () => 'default'
	};

	api.get(/^\/youtube/, async (req, res, next) => {
		const key = JSON.stringify(req.query);
		const {id} = req.query;
		logger.log('%s Resolving Video data for %s', key, id);

		try {
			const source = await MediaSourceFactory.from(DUMMY_SERVICE, getSourceURL(id));
			const resolver = MetaDataResolver.getProvider(source);

			const uri = appendQueryParams(await resolver.resolveURL(DUMMY_SERVICE, id), req.query);

			// const service = await server.getServiceDocument(req);

			logger.log('%s Requesting...', key);
			const r = await fetch(uri, {
				headers: {
					Referer: req.header('Referer') || origin('https://' + req.headers.host + (req.originalUrl || req.url))
				}
			});

			res.status(r.status);

			logger.debug('%s Responded: %s', key, r.status);

			for (let [h, value] of r.headers) {
				logger.debug('%s [header] %s: %s', key, h, value);
				// res.set(h, value);
			}

			logger.debug('%s Reading response body...', key);

			res.json(await r.json());
			res.end();

			logger.debug('%s Done.', key);

		} catch (e) {
			logger.error('%s Oops...', key, e);
			next(e);
		}

	});
};


function origin (uri) {
	return Object.assign(url.parse(uri), {
		hash: null,
		search: null,
		query: null,
		pathname: null,
		path: null
	}).format();
}
