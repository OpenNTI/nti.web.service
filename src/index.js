#!/usr/bin/env node
'use strict';

//add polyfills and shims
require('core-js');
global.fetch = global.fetch || require('node-fetch');

const cluster = require('cluster');

const {start: startMaster} = require('./master');
const {start: startWorker} = require('./worker');

if (cluster.isMaster) {
	startMaster();
} else {
	startWorker();
}
