'use strict';
require('memored');
const cluster = require('cluster');
const fs = require('fs');

const Sentry = require('@sentry/node');

const pkg = require('../package.json');

const {
	getStackOrMessage,
	getErrorMessage,
	callThresholdMet,
} = require('./lib/utils');
const { loadConfig, showFlags } = require('./lib/config');
const logger = require('./lib/logger');
const {
	getConfig,
	setConfig,
	getConfiguredWorkerCount,
	setConfiguredWorkerCount,
	getActiveWorkers,
} = require('./lib/master-utils');

const self = Object.assign(exports, {
	start,

	//testing
	load,
	init,
	startWorker,
	maintainWorkerCount,
	restartWorkers,
	onWorkerExit,
	handleMessage,
});

let devmode = false;

const MESSAGE_HANDLERS = {
	NOTIFY_DEVMODE() {
		logger.warn('Restricting workers, because devmode.');
		devmode = true;
		setConfiguredWorkerCount(1);
	},

	WORKER_WANTS_TO_RESTART_THE_POOL() {
		self.restartWorkers();
	},

	FATAL_ERROR() {
		logger.error('Recieved a FATAL_ERROR code from a worker.');
	},
};

function start() {
	logger.info(
		'Starting up. (version: %s, process: %d)',
		pkg.version,
		process.pid
	);
	process.on('SIGHUP', self.load);
	cluster.on('message', self.handleMessage);
	cluster.on('exit', self.onWorkerExit);

	self.load();
}

function load() {
	logger.info('Loading config.');
	return loadConfig() //return for testing
		.then(self.init)
		.catch(error => {
			/* istanbul ignore next */
			logger.error(
				'Failed to start: %s',
				(error && (error.stack || error.message)) ||
					JSON.stringify(error, void 0, 2)
			);
		});
}

function init(config) {
	logger.info('Config loaded.');
	showFlags(config);

	config.versions = {
		...(config.versions || {}),
		service: pkg.version, //tell apps what version we are
	};

	if (config.sentry) {
		Sentry.init(config.sentry);
	}

	setConfig(config);

	if (getActiveWorkers().length === 0) {
		self.maintainWorkerCount();
	} else {
		self.restartWorkers();
	}
}

function startWorker() {
	try {
		logger.info('Starting Worker...');

		if (callThresholdMet(startWorker, getConfiguredWorkerCount() * 2)) {
			logger.error('Too many worker cycles in a second');
			return process.exit(1);
		}

		if (!fs.existsSync(process.argv[1])) {
			throw new Error('Missing Code, cannot fork.');
		}

		const config = getConfig();
		const worker = cluster.fork();
		worker.send({ topic: 'default', cmd: 'init', config });
		return worker;
	} catch (e) {
		logger.warn('MISSING CODE: Cannot start a worker.');
		logger.debug('MISSING CODE: Cannot access "%s"', process.argv[1]);
		clearTimeout(self.missingCode);
		self.missingCode = setTimeout(self.maintainWorkerCount, 1000);
	}
}

function maintainWorkerCount() {
	// Prevent memory leaks...
	// If a worker exists while we're already processing, drop the previous handlers and start over
	const listeners = cluster.listeners('listening') || [];
	if (listeners.length > 0) {
		//free the previous handler and its closure stack references. (being careful, not to remove OTHER listeners)
		listeners.forEach(
			x =>
				x.name === startAnother.name &&
				cluster.removeListener('listening', x)
		);
	}

	cluster.on('listening', startAnother);
	const { port } = getConfig();
	const unsubscribe = () => {
		cluster.removeListener('listening', startAnother);
	};

	let pendingWorker = null;
	startAnother();

	function startAnother(worker, address) {
		if (pendingWorker && worker !== pendingWorker) {
			// ignore workers other than ours
			logger.debug(
				'Ignoring listening event, because its not the one we are waiting on.'
			);
			return;
		}

		if (address && address.port !== port) {
			// ignore other listener events
			logger.debug(
				'Ignoring listening event, because its for another port.'
			);
			return;
		}

		const workers = getConfiguredWorkerCount();
		const workersRunning = getActiveWorkers().length;
		logger.info(
			'Workers: active: %d, configured: %d',
			workersRunning,
			workers
		);

		if (workersRunning < workers) {
			pendingWorker = self.startWorker();
		} else {
			unsubscribe();
		}
	}
}

function restartWorkers() {
	if ((x => x && x.length > 0)(restartWorkers.queue)) {
		logger.warn(
			'\n\n\nIgnoring restartWorkers() request while in the middle of restarting workers.'
		);
		return;
	}

	const queue = (restartWorkers.queue = [...getActiveWorkers()]);
	const targetWorkerCount = getConfiguredWorkerCount();

	logger.info('Restarting %d workers...', queue.length);

	function rollingRestart() {
		const worker = queue.shift();
		const triggerEvent =
			targetWorkerCount <= queue.length ? 'exit' : 'listening';

		if (worker) {
			logger.info(
				'using "%s" event as the restart-continuation',
				triggerEvent
			);
			logger.info(
				'Restarting (close & respawn) worker..., (%d remain)',
				queue.length
			);
			cluster.once(triggerEvent, rollingRestart);
			// cluster.once('online', rollingRestart);
			try {
				if (worker.isConnected()) {
					worker.send({ topic: 'default', cmd: 'close' });
				}
			} catch (e) {
				logger.error(getStackOrMessage(e));
			}
		}
	}

	rollingRestart();
}

function onWorkerExit(worker, code, signal) {
	logger.info(
		'worker %d exited (code: %s%s)',
		worker.process.pid,
		code,
		signal ? `, signal: ${signal}` : ''
	);

	if (devmode && code !== 0) {
		return process.exit(code);
	}

	self.maintainWorkerCount();
}

function handleMessage(worker, msg) {
	if ((msg || {}).topic !== 'default') {
		return;
	}

	logger.debug('From Worker %d: %o', worker.id, msg);
	try {
		MESSAGE_HANDLERS[msg.cmd](msg);
		return;
	} catch (e) {
		/* istanbul ignore next */
		logger.error('Could not handle message. %o', getErrorMessage(e), msg);
		return;
	}
}
