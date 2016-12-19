const pkg = require('../package.json');
const cluster = require('cluster');
const {loadConfig, showFlags} = require('./lib/config');
const logger = require('./lib/logger');

const STORE = {};

Object.assign(exports, {
	start
});


const getConfig = () => STORE.config;
const setConfig = x => STORE.config = x;
const isValidWorkerCount = x => !isNaN(x) && x > 0;
const getConfiguredWorkerCount = x => (x = parseInt(getConfig().workers, 10), isValidWorkerCount(x) ? x : 1);
const setConfiguredWorkerCount = n => {getConfig().workers = n;};
const getActiveWorkers = () => Object.values(cluster.workers).filter(x => !x.isDead());


function start () {
	logger.info('Staring up. (version: %s, process: %d)', pkg.version, process.pid);
	process.on('SIGHUP', load);
	cluster.on('message', handleMessage);
	cluster.on('exit', onWorkerExit);

	load();
}


function load () {
	logger.info('Loading config.');
	loadConfig()
		.then(init)
		.catch(error => {
			logger.error('Failed to start: %s', error.stack || error.message || JSON.stringify(error));
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
		maintainWorkerCount();
	} else {
		restartWorkers();
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
	const {port} = getConfig();
	const unsubscribe = () => cluster.removeListener('listening', startAnother);
	cluster.on('listening', startAnother);

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
			pendingWorker = startWorker();
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
	logger.info('worker %d exited (%s). restarting...', worker.process.pid, signal || code);
	maintainWorkerCount();
}


function handleMessage (worker, message) {
	logger.debug('From Worker %d: %o', worker.id, message);
	if ((message || {}).cmd === 'NOTIFY_DEVMODE') {
		logger.warn('Restricting workers, because devmode.');
		setConfiguredWorkerCount(1);
	}
}
