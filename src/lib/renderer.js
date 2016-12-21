const logger = require('./logger');
const {clientConfig, nodeConfigAsClientConfig} = require('./config');

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

function getPageRenderer ({appId, basepath} = {}, config, datacache, render) {

	return function renderPage (req, res) {
		logger.info('Rendering Inital View: %s %s', req.url, req.username);
		let isErrorPage = false;

		const pageRenderSetPageNotFound = ()=> isErrorPage = true;

		//Pre-flight (if any widget makes a request, we will cache its result and send its result to the client)
		const renderPass = asPromise(() => render(basepath, req, nodeConfigAsClientConfig(config, appId, req), pageRenderSetPageNotFound));

		const prefetch = Promise.all([
			renderPass,
			req.waitForPending ?
				req.waitForPending(5 * 60000/* 5 minutes*/) :
				Promise.resolve()
		]);


		return prefetch
			.then(()=> {
				if (isErrorPage) {
					res.status(404);
				}

				const configForClient = clientConfig(config, req.username, appId, req);
				configForClient.html += datacache.getForContext(req).serialize();

				//Final render
				return Promise.resolve(render(basepath, req, configForClient))
					.then(content => {
						logger.info('Flushing Render to client: %s %s', req.url, req.username);
						res.send(content);
					});
			})
			.catch(error => {
				/* istanbul ignore next */
				logger.error(error.stack || error.message || error);
				res.status(500);
				res.end(error);
			});
	};
}
