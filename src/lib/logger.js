'use strict';
const { isMaster, worker } = require('cluster');

const morgan = require('morgan');
const responseTime = require('response-time');
const debug = require('debug');

const get = name => ({
	info: debug(name + ':info'),
	error: debug(name + ':error'),
	warn: debug(name + ':warn'),
	debug: debug(name + ':debug'),
	trace: debug(name + ':trace'),
});

const pattern = debug.load();
if (!pattern) {
	debug.enable(
		pattern || ['info', 'error', 'warn'].map(x => `*:${x}`).join(',')
	);
}

const BASE_NAME =
	'NodeService:' + (isMaster ? 'master' : 'worker:' + worker.id);
const logger = get(BASE_NAME);

module.exports = Object.assign(morgan, {
	get(name) {
		return get(BASE_NAME + ':' + name);
	},

	attachToExpress: expressApp => {
		expressApp.use(responseTime());
		expressApp.use(
			morgan(
				':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent""'
			)
		);
	},

	info() {
		logger.info(...arguments);
	},

	error() {
		logger.error(...arguments);
	},

	warn() {
		logger.warn(...arguments);
	},

	debug() {
		logger.debug(...arguments);
	},
});
