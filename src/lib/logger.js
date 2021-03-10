'use strict';
const { isMaster, worker } = require('cluster');

const morgan = require('morgan');
const responseTime = require('response-time');

const { default: Logger } = require('@nti/util-logger');

const BASE_NAME =
	'NodeService:' + (isMaster ? 'master' : 'worker:' + worker.id);
const logger = Logger.get(BASE_NAME);

module.exports = Object.assign(morgan, {
	get(name) {
		return Logger.get(BASE_NAME + ':' + name);
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
