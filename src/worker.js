const pkg = require('../package.json');
const cluster = require('cluster');
const http = require('http');
const proxiedHttp = require('findhit-proxywrap').proxy(http);

const express = require('express');
const appService = require('./lib/app-service');

const logger = require('./lib/logger');
const setupErrorHandler = require('./lib/error-handler');

const sendErrorMessage = e => process.send({cmd: 'FATAL_ERROR', error: e});

Object.assign(exports, {
	start
});

const MESSAGE_HANDLERS = {

	init (msg) {
		try {
			this.server = init(msg.config);
		} catch (e) {
			process.exitCode = 1;
			logger.error(e.message || e);
			sendErrorMessage(e);
			this.close();
		}
	},


	close () {
		logger.info('Asked to close...');
		if (!this.server) {
			logger.error('No server, exiting...');
			cluster.worker.disconnect();
			// process.exit();
			return;
		}

		this.server.close(() => {
			logger.info('Closed connection');
			cluster.worker.disconnect();
			// process.exit();
		});
	}

};



function start ()  {
	logger.info('Staring up. (version: %s, process: %d)', pkg.version, process.pid);
	process.on('message', messageHandler);
}



function init (config) {
	const protocol = config.protocol === 'proxy' ? proxiedHttp : http;
	const address = config.address || '0.0.0.0';

	//WWW Server
	const app = express();

	app.set('trust proxy', 1); // trust first proxy

	const port = appService.setupApplication(app, config);

	//Errors
	setupErrorHandler(app, config);

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
		logger.error('Could not handle message. %o', e.message || e.stack || e);
		return;
	}
}
