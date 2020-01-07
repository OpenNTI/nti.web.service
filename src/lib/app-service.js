'use strict';
global.SERVER = true;

const cookieParser = require('cookie-parser');
const express = require('express');
const requestLanguage = require('express-request-language');
const staticFiles = require('serve-static');
const {default: dataserver} = require('@nti/lib-interfaces');

const getApplication = require('./app-loader');
const registerEndPoints = require('./api');
const {SERVER_REF, DATACACHE} = require('./constants');
const {attachToExpress: setupCompression} = require('./compress');
const apiProxy = require('./api-proxy');
const cacheBuster = require('./no-cache');
const Session = require('./session');
const logger = require('./logger');
const cors = require('./cors');
const frameOptions = require('./frame-options');
const unsupportedPage = require('./unsupported');
const {getPageRenderer} = require('./renderer');
const {restartOnModification} = require('./restart');
const {send} = require('./utils');

const isManifest = RegExp.prototype.test.bind(/\.appcache$/i);

const ANONYMOUS_ROUTES = /^\/login/i;
const AUTHENTICATED_ROUTES = /^\/(?!(api|login|resources)).*/i;
const FORCE_ERROR_ROUTE = '/errortest*';

const self = Object.assign(exports, {
	contextualize,
	forceError,
	setupInterface,
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
		cacheBuster(null, res);
	}
}


function contextualize (root, app) {
	const contextWapper = express();
	contextWapper.set('views', app.get('views'));
	contextWapper.set('etag', false);
	app.use(root, contextWapper);
	return contextWapper;
}


function resourceNotFound (_, res) {
	res.status(404).send('Asset Not Found');
}


function forceError () {
	throw new Error('This is an error. Neato.');
}

function setupInterface (config) {
	return (req, res, next) => {
		const {protocol, headers: { host }} = req;
		const server = new URL(config.server, `${protocol}://${host}`).toString();
		const {datacache, interface: _interface} = dataserver({...config, server});
		logger.debug('DataServer end-point: %s', server);
		req.config = config;
		req[SERVER_REF] = _interface;
		req[DATACACHE] = datacache;
		next();
	};
}

async function setupApplication (server, config, restartRequest) {
	if (!config || Object.keys(config).length === 0) {
		throw new Error('No configuration');
	}

	//config.silent = true;

	const params = {server, config, restartRequest};

	server.use(cookieParser());
	server.use(cors);
	server.use(frameOptions);
	// server.use(cacheBuster);
	server.use(/.*\/unsupported(\.html)?/, unsupportedPage(config));

	if (config.mode !== 'development') {
		logger.attachToExpress(server);
	}

	for (let client of config.apps) {
		await self.setupClient(client, params);
	}

	// The proxy comes last as a fall through
	if (config.proxy) {
		server.use('*', apiProxy(config));
	}

	return server;
}

async function setupClient (client, {config, server, restartRequest}) {
	logger.info('Setting up app (version: %s):', client.appVersion || 'Unknown');

	const flatConfig = {...config, ...client, logger};  //flattened config
	const {register, file} = getApplication(client.package);
	const {basepath} = client;

	if (file) {
		restartOnModification(file);
	}

	const clientRoute = self.contextualize(basepath, server);
	logger.info('mount-point: %s', basepath);

	// Tag the server interface reference on the request so we can use it in lower middlewares...
	clientRoute.use(self.setupInterface(config));

	try {
		const registration = await Promise.resolve(register(clientRoute, flatConfig, restartRequest));
		const {
			assets,
			devmode,
			locales,
			render,
			renderContent,
			sessionSetup
		} = registration;

		//add the assets path to the client object (keep it out of the config)
		client = {...client, assets, devmode};

		const session = new Session(sessionSetup);

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

		registerEndPoints(clientRoute, flatConfig);

		if (flatConfig.public !== true) {
			//Session manager...
			clientRoute.use(ANONYMOUS_ROUTES, (r, q, n) => void session.anonymousMiddleware(basepath, r, q, n));
			clientRoute.use(AUTHENTICATED_ROUTES, (r, q, n) => void session.middleware(basepath, r, q, n));
		} else {
			clientRoute.use('*', (r, q, n) => void session.anonymousMiddleware(basepath, r, q, n));
		}

		//HTML Renderer...
		clientRoute.get('*', getPageRenderer(client, config, render, renderContent));

		if (devmode) {
			send({cmd: 'NOTIFY_DEVMODE'});
			devmode.start();
		}
	}
	catch(e) {
		logger.error(e.stack);
		process.exit(1);
	}
}
