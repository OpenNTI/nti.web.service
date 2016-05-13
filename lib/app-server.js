/*eslint strict: 0*/
'use strict';
global.SERVER = true;

const express = require('express');
const dataserver = require('nti-lib-interfaces').default;

const registerEndPoints = require('./api');
const cacheBuster = require('./no-cache');
const common = require('./common');
const clientConfig = common.clientConfig;
const nodeConfigAsClientConfig = common.nodeConfigAsClientConfig;

const logger = require('./logger');
const setupCORS = require('./cors');
const setupCompression = require('./compress');

const manifest = /\.appcache$/i;

function contextualize (root, app) {
	const contextWapper = express();
	app.use(root, contextWapper);
	return contextWapper;
}

exports.setupApplication = (app, config) => {
	const port = config.port = (config.port || 9000);
	//config.silent = true;
	const dsi = dataserver(config);
	const session = dsi.session;
	const datacache = dsi.datacache;

	logger.info('DataServer end-point: %s', config.server);
	logger.attachToExpress(app);
	app.use(cacheBuster);
	setupCORS(app);

	for (let client of config.apps) {
		logger.info('Setting up app:');
		let flatConfig = Object.assign({}, config, client);  //flattened config
		let register = require.main.require(client.package).register;
		let basepath = client.basepath;
		let appId = client.appId;

		let clientRoute = contextualize(basepath, app);
		logger.info('mount-point: %s', basepath);

		let reg = register(clientRoute, flatConfig);
		let assets = reg.assets;
		let render = reg.render;
		let devmode = reg.devmode;

		setupCompression(clientRoute, assets);
		logger.info('Static Assets: %s', assets);

		//Static files...
		clientRoute.use(express.static(assets, {
			maxage: 3600000, //1hour
			setHeaders: (res, requsestPath) => {
				if (manifest.test(requsestPath)) {
					//manifests never cache
					res.setHeader('Cache-Control', 'public, max-age=0');
				}
			}
		}));//static files

		//Do not let requests for static assets (that are not found) fall through to page rendering.
		clientRoute.get(/^\/(js|resources)\//i, (_, res)=>
			res.status(404).send('Asset Not Found'));


		clientRoute.use('/errortest*', function () {
			throw new Error('This is an error. Neato.');
		});


		registerEndPoints(
			clientRoute, //express instance
			flatConfig,
			dsi.interface); //interface

		clientRoute.use(/^\/login/i, (r, q, n) => session.anonymousMiddleware(basepath, r, q, n));

		//Session manager...
		clientRoute.use(/^\/(?!(api|login|resources)).*/i, (r, q, n) => session.middleware(basepath, r, q, n));

		//HTML Renderer...
		clientRoute.get('*', (req, res)=> {
			logger.info('Rendering Inital View: %s %s', req.url, req.username);
			let isErrorPage = false;
			/*eslint no-underscore-dangle: 0*/
			global.pageRenderSetPageNotFound = ()=>isErrorPage = true;

			//Pre-flight (if any widget makes a request, we will cache its result and send its result to the client)
			render(basepath, req, nodeConfigAsClientConfig(config, appId, req));

			if (isErrorPage) {
				res.status(404);
			}

			const prefetch = req.waitForPending ?
					req.waitForPending(5 * 60000/* 5 minutes*/) :
					Promise.resolve();


			prefetch.then(
				()=> {
					let configForClient = clientConfig(req.username, appId, req);
					configForClient.html += datacache.getForContext(req).serialize();
					//Final render
					logger.info('Flushing Render to client: %s %s', req.url, req.username);
					res.send(render(basepath, req, configForClient));
				},

				error => {
					logger.error(error.stack || error.message || error);
					res.end(error);
				});
		});

		if (devmode) {
			devmode.start();
		}
	}

	return port;
};
