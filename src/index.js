#!/usr/bin/env node
'use strict';
require('./polyfills');

const cluster = require('cluster');

const {start: startMaster} = require('./master');
const {start: startWorker} = require('./worker');

if (cluster.isMaster) {
	startMaster();
} else {
	startWorker();
}
