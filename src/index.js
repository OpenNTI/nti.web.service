#!/usr/bin/env node
'use strict';

module.exports.resolve = x => require.resolve(x);

function run () {
	require('./polyfills');

	const cluster = require('cluster');

	const {start: startMaster} = require('./master');
	const {start: startWorker} = require('./worker');

	if (cluster.isMaster) {
		startMaster();
	} else {
		startWorker();
	}
}

//Imported
if (require.main === module) {
	/* istanbul ignore next */
	run();
}

Object.assign(module.exports, {
	run,
	setup: require('./worker').getApp,
	logger: require('./lib/logger')
});
