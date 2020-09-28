'use strict';
const {worker} = require('cluster');
const http = require('http');
const https = require('https');
const path = require('path');

const express = require('express');
const {proxy: createProxy} = require('findhit-proxywrap');

const pkg = require('../package.json');

const logger = require('./lib/logger');
const htmlTemplates = require('./lib/html-templates');
const {restart} = require('./lib/restart');
const {setupApplication} = require('./lib/app-service');
const {setupErrorHandler} = require('./lib/error-handler');
const {getStackOrMessage, getErrorMessage, send} = require('./lib/utils');

const sendErrorMessage = e => send({cmd: 'FATAL_ERROR', error: e});

const self = Object.assign(exports, {
	start,

	//for tests
	init,
	messageHandler,
	getApp
});

const MESSAGE_HANDLERS = {

	async init (msg) {
		try {
			this.server = await self.init(msg.config);
		} catch (e) {
			process.exitCode = 1;
			logger.error(getStackOrMessage(e));
			sendErrorMessage(e);
			this.close();
		}
	},


	close () {
		logger.info('Asked to close...');
		if (!this.server) {
			logger.error('No server, exiting...');
			worker.disconnect();
			process.exit();
		}

		this.server.close(() => {
			logger.info('Closed connection');
			worker.disconnect();
			process.exit();
		});
	}

};



function start ()  {
	logger.info('Starting up. (version: %s, process: %d)', pkg.version, process.pid);
	process.on('message', self.messageHandler);
	process.on('SIGHUP', restart);
}


async function getApp (config) {
	//WWW Server
	const app = express();
	app.engine('html', htmlTemplates);

	app.set('trust proxy', true);
	app.set('views', path.resolve(__dirname, 'templates'));
	app.set('view engine', 'html');

	await setupApplication(app, config, restart);

	//Errors
	setupErrorHandler(app, config);
	return app;
}


async function createServer (protocol, app) {
	const FACTORIES = {
		proxy: () => createProxy(http).createServer(app),
		http: () => http.createServer(app),
		https: async () => {
			try {
				// eslint-disable-next-line import/no-extraneous-dependencies
				const { getHTTPS } = require('@nti/dev-ssl-config');
				const options = await getHTTPS();

				return https.createServer(options, app);
			} catch (e) {
				const newErr = new Error('Could not create https server.');
				newErr.stack += '\nCaused by: ' + e.stack;
				throw newErr;
			}
		}
	};

	const factory = FACTORIES[protocol] || FACTORIES.http;

	return factory();
}


async function init (config) {
	const address = config.address || '0.0.0.0';
	const port = config.port;

	const app = await getApp(config);

	const server = await createServer(config.protocol, app);

	//Go!
	server.listen(port, address, () => {
		logger.info('Listening on port %d', port);
	});

	return server;
}



async function messageHandler (msg) {
	if ((msg || {}).topic !== 'default') {
		return;
	}

	try {
		await MESSAGE_HANDLERS[msg.cmd](msg);
		return;
	} catch (e) {
		logger.error('Could not handle message. %o', getErrorMessage(e), msg);
		return;
	}
}
