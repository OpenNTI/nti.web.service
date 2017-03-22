const cluster = require('cluster');

const pkg = require('../package.json');

const {loadConfig, showFlags} = require('./lib/config');
const logger = require('./lib/logger');
const {
	getConfig,
	setConfig,
	getConfiguredWorkerCount,
	setConfiguredWorkerCount,
	getActiveWorkers
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
	handleMessage
});


const MESSAGE_HANDLERS = {
	NOTIFY_DEVMODE () {
		logger.warn('Restricting workers, because devmode.');
		setConfiguredWorkerCount(1);
	},

	WORKER_WANTS_TO_RESTART_THE_POOL () {
		self.restartWorkers();
	},

	FATAL_ERROR () {
		logger.error('Recieved a FATAL_ERROR code from a worker.');
	}
};


function start () {
	logger.info('Staring up. (version: %s, process: %d)', pkg.version, process.pid);
	process.on('SIGHUP', self.load);
	cluster.on('message', self.handleMessage);
	cluster.on('exit', self.onWorkerExit);

	self.load();
}


function load () {
	logger.info('Loading config.');
	return loadConfig()//return for testing
		.then(self.init)
		.catch(error => {
			/* istanbul ignore next */
			logger.error('Failed to start: %s', (error && (error.stack || error.message)) || JSON.stringify(error));
		});
}


function init (config) {

	logger.info('Config loaded.');
	showFlags(config);

	config.versions = Object.assign({},
		config.versions || {},
		{service: pkg.version} //tell apps what version we are
	);

	setConfig(config);

	if (getActiveWorkers().length === 0) {
		self.maintainWorkerCount();
	} else {
		self.restartWorkers();
	}
}


function startWorker () {
	logger.info('Staring Worker...');
	const config = getConfig();
	const worker = cluster.fork();
	worker.send({cmd: 'init', config});
	return worker;
}


function maintainWorkerCount () {
	// Prevent memory leaks...
	// If a worker exists while we're already processing, drop the previous handlers and start over
	const listeners = cluster.listeners('listening') || [];
	if (listeners.length > 0) {
		//free the previous handler and its closure stack references. (being careful, not to remove OTHER listeners)
		listeners.forEach(x => x.name === startAnother.name && cluster.removeListener('listening', x));
	}

	cluster.on('listening', startAnother);
	const {port} = getConfig();
	const unsubscribe = () => {
		cluster.removeListener('listening', startAnother);
	};


	let pendingWorker = null;
	startAnother();

	function startAnother (worker, address) {

		if (pendingWorker && worker !== pendingWorker) {
			// ignore workers other than ours
			logger.debug('Ignoring listening event, because its not the one we are waiting on.');
			return;
		}

		if (address && address.port !== port) {
			// ignore other listener events
			logger.debug('Ignoring listening event, because its for another port.');
			return;
		}


		const workers = getConfiguredWorkerCount();
		const workersRunning = getActiveWorkers().length;
		logger.info('Workers: active: %d, configured: %d', workersRunning, workers);

		if (workersRunning < workers) {
			pendingWorker = self.startWorker();
		} else {
			unsubscribe();
		}
	}
}


function restartWorkers () {
	const queue = getActiveWorkers();
	const targetWorkerCount = getConfiguredWorkerCount();


	function rollingRestart () {
		const worker = queue.shift();
		const triggerEvent = targetWorkerCount <= queue.length ? 'exit' : 'listening';
		logger.info('using "%s" event as the restart-continuation', triggerEvent);
		if (worker) {
			logger.info('Restaring (close & respawn) worker...');
			cluster.once(triggerEvent, rollingRestart);
			// cluster.once('online', rollingRestart);
			worker.send({cmd: 'close'});
		}
	}

	rollingRestart();
}


function onWorkerExit (worker, code, signal) {
	logger.info('worker %d exited (%s)', worker.process.pid, signal || code);
	if (!code) {
		self.maintainWorkerCount();
	}
}


function handleMessage (worker, msg) {
	logger.debug('From Worker %d: %o', worker.id, msg);
	try {
		MESSAGE_HANDLERS[msg.cmd](msg);
		return;
	} catch (e) {
		/* istanbul ignore next */
		logger.error('Could not handle message. %o', e.message || e.stack || e);
		return;
	}
}
