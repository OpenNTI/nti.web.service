const cluster = require('cluster');
const http = require('http');
const proxiedHttp = require('findhit-proxywrap').proxy(http);

const express = require('express');
const appService = require('./lib/app-service');

const logger = require('./lib/logger');
const setupErrorHandler = require('./lib/error-handler');

Object.assign(exports, {
	start
});

const MESSAGE_HANDLERS = {

	init (msg) {
		this.server = init(msg.config);
	},


	close () {
		if (!this.server) {
			logger.error('No server, exiting...');
			return process.kill();
		}

		this.server.close(() => {
			logger.info('Closed connection');
			cluster.worker.disconnect();
			process.exit();
		});
	}

};



function start ()  {
	logger.info('Staring up. process: %d', process.pid);
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

	server = protocol.createServer(app);

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
