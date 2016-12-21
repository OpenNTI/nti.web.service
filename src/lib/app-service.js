'use strict';
global.SERVER = true;

const express = require('express');
const {default: dataserver} = require('nti-lib-interfaces');

const registerEndPoints = require('./api');

const {attachToExpress: setupCompression} = require('./compress');
const cacheBuster = require('./no-cache');
const Session = require('./session');
const logger = require('./logger');
const cors = require('./cors');
const {getPageRenderer} = require('./renderer');

const isManifest = RegExp.prototype.test.bind(/\.appcache$/i);

const ANONYMOUS_ROUTES = /^\/login/i;
const AUTHENTICATED_ROUTES = /^\/(?!(api|login|resources)).*/i;
const FORCE_ERROR_ROUTE = '/errortest*';

const self = Object.assign(exports, {
	contextualize,
	forceError,
	neverCacheManifestFiles,
	resourceNotFound,
	setupApplication,
	setupClient,

	ANONYMOUS_ROUTES,
	AUTHENTICATED_ROUTES,
	FORCE_ERROR_ROUTE
});


function neverCacheManifestFiles (res, requsestPath) {
	if (isManifest(requsestPath)) {
		//manifests never cache
		cacheBuster(null, res, () => {});
	}
}


function contextualize (root, app) {
	const contextWapper = express();
	app.use(root, contextWapper);
	return contextWapper;
}


function resourceNotFound (_, res) {
	res.status(404).send('Asset Not Found');
}


function forceError () {
	throw new Error('This is an error. Neato.');
}


function setupApplication (server, config, restartRequest) {
	//config.silent = true;

	const params = Object.assign({server, config, restartRequest}, dataserver(config));

	logger.info('DataServer end-point: %s', config.server);
	logger.attachToExpress(server);
	server.use(cacheBuster);
	server.use(cors);

	for (let client of config.apps) {
		self.setupClient(client, params);
	}

	return config.port;
}


function setupClient (client, {config, server, datacache, interface: _interface, restartRequest}) {
	logger.info('Setting up app (version: %s):', client.appVersion || 'Unknown');

	const flatConfig = Object.assign({}, config, client);  //flattened config
	const {register} = require.main.require(client.package);
	const {basepath} = client;

	const clientRoute = self.contextualize(basepath, server);
	logger.info('mount-point: %s', basepath);

	const {assets, render, devmode, sessionSetup} = register(clientRoute, flatConfig, restartRequest);

	const session = new Session(_interface, sessionSetup);

	setupCompression(clientRoute, assets);
	logger.info('Static Assets: %s', assets);

	//Static files...
	clientRoute.use(express.static(assets, {
		maxage: 3600000, //1hour
		setHeaders: self.neverCacheManifestFiles
	}));//static files

	//Do not let requests for static assets (that are not found) fall through to page rendering.
	clientRoute.get(/^\/(js|resources)\//i, self.resourceNotFound);


	clientRoute.use(FORCE_ERROR_ROUTE, self.forceError);


	registerEndPoints(
		clientRoute, //express instance
		flatConfig,
		_interface); //interface

	clientRoute.use(ANONYMOUS_ROUTES, (r, q, n) => void session.anonymousMiddleware(basepath, r, q, n));

	//Session manager...
	clientRoute.use(AUTHENTICATED_ROUTES, (r, q, n) => void session.middleware(basepath, r, q, n));

	//HTML Renderer...
	clientRoute.get('*', getPageRenderer(client, config, datacache, render));

	if (devmode) {
		process.send({cmd: 'NOTIFY_DEVMODE'});
		devmode.start();
	}
}
