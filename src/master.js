const cluster = require('cluster');
const common = require('./lib/common');
const logger = require('./lib/logger');

Object.assign(exports, {
	start
});

function getActiveWorkers () {
	return Object.values(cluster.workers).filter(x => !x.isDead());
}


let startWorker = () => {};
let maintainWorkerCount = () => {};

function start () {
	logger.info('Staring up. process: %d', process.pid);
	process.on('message', handleMessage);
	process.on('SIGHUP', load);
	cluster.on('exit', onWorkerExit);

	load();
}


function load () {
	logger.info('Loading config.');
	common.loadConfig()
		.then(init)
		.catch(error => {
			logger.error('Failed to start: %s', error.stack || error.message || JSON.stringify(error));
			process.kill();//just in case dev server is already up.
		});
}


function getWorkerCount (config) {
	const isValid = x => isNaN(x) || x <= 0;

	let x = parseInt(config.workers, 10);

	return isValid(x) ? x : 1;
}


function init (config) {

	logger.info('Config loaded.');
	common.showFlags(config);

	const workers = getWorkerCount(config);

	startWorker = () => void cluster.fork().send({cmd: 'init', config});

	maintainWorkerCount = () => {
		const workersRunning = getActiveWorkers().length;
		logger.info('%d, %d', workersRunning, workers);
		for (let  i = workersRunning; i < workers; i++) {
			startWorker();
		}
	}

	if (getActiveWorkers().length === 0) {
		maintainWorkerCount();
	} else {
		restartWorkers();
	}
}


function restartWorkers () {
	const queue = getActiveWorkers();


	function rollingRestart () {
		const worker = queue.shift();
		if (worker) {
			cluster.once('listening', rollingRestart);
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


function handleMessage (msg) {
	logger.info('%o', msg);
}
