'use strict';
const {worker} = require('cluster');
const http = require('http');
const path = require('path');

const express = require('express');
const {proxy: createProxy} = require('findhit-proxywrap');

const pkg = require('../package.json');

const logger = require('./lib/logger');
const htmlTemplates = require('./lib/htmlTemplates');
const {restart} = require('./lib/restart');
const {setupApplication} = require('./lib/app-service');
const {setupErrorHandler} = require('./lib/error-handler');
const {getStackOrMessage, getErrorMessage} = require('./lib/util');

const sendErrorMessage = e => process.send({cmd: 'FATAL_ERROR', error: e});

const self = Object.assign(exports, {
	start,

	//for tests
	init,
	messageHandler,
	getApp
});

const MESSAGE_HANDLERS = {

	init (msg) {
		try {
			this.server = self.init(msg.config);
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
			return;
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


function getApp (config) {
	//WWW Server
	const app = express();
	app.engine('html', htmlTemplates);

	app.set('trust proxy', 1); // trust first proxy
	app.set('views', path.resolve(__dirname, 'templates'));
	app.set('view engine', 'html');

	setupApplication(app, config, restart);

	//Errors
	setupErrorHandler(app, config);
	return app;
}


function init (config) {
	const protocol = config.protocol === 'proxy' ? createProxy(http) : http;
	const address = config.address || '0.0.0.0';
	const port = config.port;

	const app = getApp(config);

	const server = protocol.createServer(app);

	//Go!
	server.listen(port, address, () => {
		logger.info('Listening on port %d', port);
	});

	return server;
}



function messageHandler (msg) {
	try {
		MESSAGE_HANDLERS[msg.cmd](msg);
		return;
	} catch (e) {
		logger.error('Could not handle message. %o', getErrorMessage(e));
		return;
	}
}
