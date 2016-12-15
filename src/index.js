#!/usr/bin/env node
'use strict';
require('core-js'); //add polyfills and shims

global.fetch = global.fetch || require('node-fetch');

const http = require('http');
const proxiedHttp = require('findhit-proxywrap').proxy(http);

const express = require('express');
const common = require('./lib/common');
const server = require('./lib/app-server');

const logger = require('./lib/logger');
const setupErrorHandler = require('./lib/error-handler');

common.loadConfig()
	.then(config => {
		logger.info('Config loaded.');
		common.showFlags(config);

		const protocol = config.protocol === 'proxy' ? proxiedHttp : http;
		const address = config.address || '0.0.0.0';

		//WWW Server
		const app = express();

		app.set('trust proxy', 1); // trust first proxy

		const port = server.setupApplication(app, config);

		//Errors
		setupErrorHandler(app, config);

		//Go!
		protocol.createServer(app).listen(port, address, () => {
			logger.info('Listening on port %d', port);
		});

	}, error => {
		logger.error('Failed to load config: ', error);
	})

	.catch(function (error) {
		logger.error('Failed to start: %s', error.stack || error.message || JSON.stringify(error));
		process.kill();//just in case dev server is already up.
	});
