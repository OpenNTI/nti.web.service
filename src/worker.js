'use strict';
const { worker } = require('cluster');
const http = require('http');
const https = require('https');
const path = require('path');

const express = require('express');
const Sentry = require('@sentry/node');
const Tracing = require('@sentry/tracing');
const { proxy: createProxy } = require('findhit-proxywrap');

const pkg = require('../package.json');

const logger = require('./lib/logger');
const htmlTemplates = require('./lib/html-templates');
const { restart } = require('./lib/restart');
const { setupApplication } = require('./lib/app-service');
const { setupErrorHandler } = require('./lib/error-handler');
const { getStackOrMessage, getErrorMessage, send } = require('./lib/utils');

const sendErrorMessage = e => send({ cmd: 'FATAL_ERROR', error: e });

const self = Object.assign(exports, {
	start,

	//for tests
	init,
	messageHandler,
	getApp,
});

const MESSAGE_HANDLERS = {
	async init(msg) {
		try {
			this.server = await self.init(msg.config);
		} catch (e) {
			process.exitCode = 1;
			logger.error(getStackOrMessage(e));
			sendErrorMessage(e);
			this.close();
		}
	},

	close() {
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
	},
};

function start() {
	logger.info(
		'Starting up. (version: %s, process: %d)',
		pkg.version,
		process.pid
	);
	process.on('message', self.messageHandler);
	process.on('SIGHUP', restart);
	process.on('unhandledRejection', (reason, p) => {
		logger.error(
			'Unhandled Rejection at: Promise %O reason: %O',
			p,
			reason
		);
	});
}

async function getApp(config) {
	//WWW Server
	const app = express();

	if (config.sentry) {
		try {
			const ignored = RegExp.prototype.test.bind(/_ops\/ping/i);

			Sentry.init({
				integrations: [
					// enable HTTP calls tracing
					new Sentry.Integrations.Http({ tracing: true }),
					// enable Express.js middleware tracing
					new Tracing.Integrations.Express({ app }),
				],
				...config.sentry,
				tracesSampler({ request }) {
					if (ignored(request.url)) {
						// Drop this transaction, by setting its sample rate to 0%
						return 0;
					}

					// Default sample rate for all others (replaces tracesSampleRate)
					return config.sentry.tracesSampleRate;
				},
			});
			app.use(Sentry.Handlers.requestHandler());
			// TracingHandler creates a trace for every incoming request
			app.use(Sentry.Handlers.tracingHandler());
			// Do not forward these to the client
			delete config.sentry.project;
			delete config.sentry.release;
		} catch (e) {
			delete config.sentry;
			logger.error(e.stack || e.message || e);
		}
	}

	app.engine('html', htmlTemplates);
	app.set('trust proxy', true);
	app.set('views', path.resolve(__dirname, 'templates'));
	app.set('view engine', 'html');

	await setupApplication(app, config, restart);

	//Errors
	if (config.sentry) {
		app.use(
			Sentry.Handlers.errorHandler({
				shouldHandleError: err =>
					err !== 'aborted' &&
					((err || {}).error || {}).type !== 'aborted',
			})
		);
	}
	setupErrorHandler(app, config);
	return app;
}

async function createServer(protocol, app) {
	const FACTORIES = {
		proxy: () => createProxy(http).createServer(app),
		http: () => http.createServer(app),
		https: async () => {
			try {
				const { default: d, getHTTPS = d.getHTTPS } = await import(
					'@nti/dev-ssl-config'
				);
				const options = await getHTTPS();

				return https.createServer(options, app);
			} catch (e) {
				const newErr = new Error('Could not create https server.');
				newErr.stack += '\nCaused by: ' + e.stack;
				throw newErr;
			}
		},
	};

	const factory = FACTORIES[protocol] || FACTORIES.http;

	return factory();
}

async function init(config) {
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

async function messageHandler(msg) {
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
