const {worker} = require('cluster');
const http = require('http');

const express = require('express');
const {proxy: createProxy} = require('findhit-proxywrap');

const pkg = require('../package.json');

const logger = require('./lib/logger');
const {setupApplication} = require('./lib/app-service');
const {setupErrorHandler} = require('./lib/error-handler');

const sendErrorMessage = e => process.send({cmd: 'FATAL_ERROR', error: e});

const self = Object.assign(exports, {
	start,

	//for tests
	restart,
	init,
	messageHandler
});

const MESSAGE_HANDLERS = {

	init (msg) {
		try {
			this.server = self.init(msg.config);
		} catch (e) {
			process.exitCode = 1;
			/* istanbul ignore next */
			logger.error(e.message || e);
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
	process.on('SIGHUP', self.restart);
}


function restart () {
	process.send({cmd: 'WORKER_WANTS_TO_RESTART_THE_POOL'});
}


function init (config) {
	const protocol = config.protocol === 'proxy' ? createProxy(http) : http;
	const address = config.address || '0.0.0.0';

	//WWW Server
	const app = express();

	app.set('trust proxy', 1); // trust first proxy

	const port = setupApplication(app, config, self.restart);

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
		/* istanbul ignore next */
		logger.error('Could not handle message. %o', e.message || e.stack || e);
		return;
	}
}
