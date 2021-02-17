'use strict';
const { DATACACHE } = require('./constants');
const logger = require('./logger').get('renderer');
const { clientConfig, nodeConfigAsClientConfig } = require('./config');
const { getRenderer } = require('./page-renderer');

Object.assign(exports, {
	getPageRenderer,
});

function getPageRenderer(
	{ appId, basepath, assets, devmode } = {},
	config,
	render,
	renderContent
) {
	if (!render) {
		render = getRenderer(assets, renderContent, devmode);
	}

	return async function renderPage(req, res, next) {
		const { [DATACACHE]: datacache } = req;
		logger.debug('Rendering Inital View: %s %s', req.url, req.username);
		let isErrorPage = false;

		const pageRenderSetErrorCode = code => (isErrorPage = code || true);

		try {
			await Promise.all([
				//Pre-flight (if any component makes a request, we will cache its result and send its result to the client)
				render(
					basepath,
					req,
					nodeConfigAsClientConfig(config, appId, req),
					pageRenderSetErrorCode
				),

				req.waitForPending
					? req.waitForPending(5 * 60000 /* 5 minutes*/)
					: Promise.resolve(),
			]);

			const configForClient = await clientConfig(
				config,
				req.username,
				appId,
				req
			);
			if (datacache) {
				configForClient.html += datacache
					.getForContext(req)
					.serialize();
			}

			//Final render
			const content = await Promise.resolve(
				render(basepath, req, configForClient)
			);

			if (isErrorPage) {
				if (typeof isErrorPage === 'number') {
					res.status(isErrorPage);
				} else {
					res.status(404);
				}
			}

			logger.debug(
				'Flushing Render to client: %s %s',
				req.url,
				req.username
			);
			res.send(content);
		} catch (error) {
			next(error);
		}
	};
}
