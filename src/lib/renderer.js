const logger = require('./logger');
const {clientConfig, nodeConfigAsClientConfig} = require('./config');
const {getRenderer} = require('./page-renderer');

Object.assign(exports, {
	getPageRenderer
});

function asPromise (cb) {
	try {
		return cb();
	} catch (e) {
		return Promise.reject(e);
	}
}

function getPageRenderer ({appId, basepath, assets} = {}, config, datacache, render, renderContent) {

	if (!render) {
		render = getRenderer(assets, renderContent);
	}

	return function renderPage (req, res) {
		logger.debug('Rendering Inital View: %s %s', req.url, req.username);
		let isErrorPage = false;

		const pageRenderSetErrorCode = (code)=> isErrorPage = code || true;

		//Pre-flight (if any widget makes a request, we will cache its result and send its result to the client)
		const renderPass = asPromise(() => render(basepath, req, nodeConfigAsClientConfig(config, appId, req), pageRenderSetErrorCode));

		const prefetch = Promise.all([
			renderPass,
			req.waitForPending ?
				req.waitForPending(5 * 60000/* 5 minutes*/) :
				Promise.resolve()
		]);


		return prefetch
			.then(()=> {
				if (isErrorPage) {
					if (typeof isErrorPage === 'number') {
						res.status(isErrorPage);
					} else {
						res.status(404);
					}
				}

				const configForClient = clientConfig(config, req.username, appId, req);
				configForClient.html += datacache.getForContext(req).serialize();

				//Final render
				return Promise.resolve(render(basepath, req, configForClient))
					.then(content => {
						logger.debug('Flushing Render to client: %s %s', req.url, req.username);
						res.send(content);
					});
			})
			.catch(error => {
				/* istanbul ignore next */
				logger.error(error.stack || error.message || error);
				try {
					res.status(500);
					res.end(error);
				} catch (e) {
					/* istanbul ignore next */
					logger.error('Error setting status to 500', e.stack || e.message || e);
				}
			});
	};
}
