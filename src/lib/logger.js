'use strict';
const {isMaster, worker} = require('cluster');

const morgan = require('morgan');
const responseTime = require('response-time');
const cookieParser = require('cookie-parser');
const {default: Logger} = require('nti-util-logger');

const logger = Logger.get('NodeService:' + (isMaster ? 'master' : ('worker:' + worker.id)));


module.exports = Object.assign(morgan, {

	get (name) {
		return Logger.get('NodeService:' + name);
	},

	attachToExpress: expressApp => {
		expressApp.use(responseTime());
		expressApp.use(cookieParser());
		expressApp.use(morgan('- - [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'));
	},


	info () {
		logger.info(...arguments);
	},


	error () {
		logger.error(...arguments);
	},


	warn () {
		logger.warn(...arguments);
	},


	debug () {
		logger.debug(...arguments);
	}

});
