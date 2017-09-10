'use strict';
global.SERVER = true;

const cookieParser = require('cookie-parser');
const express = require('express');
const requestLanguage = require('express-request-language');
const staticFiles = require('serve-static');
const {default: dataserver} = require('nti-lib-interfaces');

const getApplication = require('./app-loader');
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
	contextWapper.set('views', app.get('views'));
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

	server.use(cookieParser());
	server.use(cors);
	// server.use(cacheBuster);

	logger.info('DataServer end-point: %s', config.server);
	if (config.mode !== 'development') {
		logger.attachToExpress(server);
	}

	for (let client of config.apps) {
		self.setupClient(client, params);
	}
}


function setupClient (client, {config, server, datacache, interface: _interface, restartRequest}) {
	logger.info('Setting up app (version: %s):', client.appVersion || 'Unknown');

	const flatConfig = Object.assign({}, config, client);  //flattened config
	const {register} = getApplication(client.package);
	const {basepath} = client;

	const clientRoute = self.contextualize(basepath, server);
	logger.info('mount-point: %s', basepath);

	const {
		assets,
		devmode,
		locales,
		render,
		renderContent,
		sessionSetup
	} = register(clientRoute, flatConfig, restartRequest);

	client = Object.assign({}, client, {assets});//add the assets path to the client object (keep it out of the config)

	const session = new Session(_interface, sessionSetup);

	clientRoute.use(requestLanguage({
		languages: [...(locales || ['en'])],
		queryName: 'locale', // ?locale=zh-CN will set the language to 'zh-CN'
		cookie: {
			name: 'language',
			options: {
				maxAge: 24 * 3600 * 1000
			}
		}
	}));

	setupCompression(clientRoute, assets);
	logger.info('Static Assets: %s', assets);

	//Static files...
	clientRoute.use(staticFiles(assets, {
		maxAge: '1 hour',
		setHeaders: self.neverCacheManifestFiles
	}));//static files

	//Do not let requests for static assets (that are not found) fall through to page rendering.
	clientRoute.get(/^\/(js|resources)\//i, self.resourceNotFound);

	clientRoute.use(cacheBuster);

	clientRoute.use(FORCE_ERROR_ROUTE, self.forceError);


	registerEndPoints(
		clientRoute, //express instance
		flatConfig,
		_interface); //interface

	clientRoute.use(ANONYMOUS_ROUTES, (r, q, n) => void session.anonymousMiddleware(basepath, r, q, n));

	if (flatConfig.public !== true) {
		//Session manager...
		clientRoute.use(AUTHENTICATED_ROUTES, (r, q, n) => void session.middleware(basepath, r, q, n));
	}

	//HTML Renderer...
	clientRoute.get('*', getPageRenderer(client, config, datacache, render, renderContent));

	if (devmode) {
		process.send({cmd: 'NOTIFY_DEVMODE'});
		devmode.start();
	}
}
