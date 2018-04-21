'use strict';
const {workers} = require('cluster');
const STORAGE = {};

const self = Object.assign(exports, {

	getConfig: () => STORAGE.config,

	setConfig: (x) => STORAGE.config = x,

	isValidWorkerCount: (x) => !isNaN(x) && (parseInt(x,10) === x) && x > 0,

	getConfiguredWorkerCount: (x) => (x = parseInt((self.getConfig() || {}).workers, 10), self.isValidWorkerCount(x) ? x : 1),

	setConfiguredWorkerCount: (n) => self.setConfig(Object.assign(self.getConfig() || {}, {workers: n})),

	getActiveWorkers: () => Object.values(workers || {}).filter(x => typeof x.isDead === 'function' && !x.isDead())
});
