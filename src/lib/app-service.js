'use strict';
global.SERVER = true;

const express = require('express');
const dataserver = require('nti-lib-interfaces').default;

const registerEndPoints = require('./api');
const cacheBuster = require('./no-cache');
const {clientConfig, nodeConfigAsClientConfig} = require('./config');

const Session = require('./session');
const logger = require('./logger');
const setupCORS = require('./cors');
const setupCompression = require('./compress');

const manifest = /\.appcache$/i;

function contextualize (root, app) {
	const contextWapper = express();
	app.use(root, contextWapper);
	return contextWapper;
}

exports.setupApplication = (server, config) => {
	//config.silent = true;
	const {port} = config;
	const {datacache, interface: _interface} = dataserver(config);

	logger.info('DataServer end-point: %s', config.server);
	logger.attachToExpress(server);
	server.use(cacheBuster);
	setupCORS(server);

	for (let client of config.apps) {
		logger.info('Setting up app (version: %s):', client.appVersion || 'Unknown');
		const flatConfig = Object.assign({}, config, client);  //flattened config
		const register = require.main.require(client.package).register;
		const basepath = client.basepath;
		const appId = client.appId;

		const clientRoute = contextualize(basepath, server);
		logger.info('mount-point: %s', basepath);

		const {assets, render, devmode, sessionSetup} = register(clientRoute, flatConfig);

		const session = new Session(_interface, sessionSetup);

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
			_interface); //interface

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
			const renderPass = render(basepath, req, nodeConfigAsClientConfig(config, appId, req));

			const prefetch = Promise.all([
				renderPass,
				req.waitForPending ?
					req.waitForPending(5 * 60000/* 5 minutes*/) :
					Promise.resolve()
			]);


			prefetch
				.then(()=> {
					if (isErrorPage) {
						res.status(404);
					}

					let configForClient = clientConfig(config, req.username, appId, req);
					configForClient.html += datacache.getForContext(req).serialize();
					//Final render
					return Promise.resolve(render(basepath, req, configForClient))
					.then(content => {
						logger.info('Flushing Render to client: %s %s', req.url, req.username);
						res.send(content);
					});
				})
				.catch(error => {
					logger.error(error.stack || error.message || error);
					res.end(error);
				});
		});

		if (devmode) {
			process.send({cmd: 'NOTIFY_DEVMODE'});
			devmode.start();
		}
	}

	return port;
};
