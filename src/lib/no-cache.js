'use strict';
const logger = require('./logger');

module.exports = function (_, res, next) {
	if (!res.headersSent) {
		res.setHeader('Cache-Control', [
			'no-cache',
			'no-store',
			'must-revalidate',
			'max-age=0'
		].join(', '));
		res.setHeader('Expires', 'Thu, 01 Jan 1970 00:00:00 GMT'); //old, but still arounad :(
		res.setHeader('Pragma', 'no-cache'); //old, but still arounad :(
	} else {
		logger.warn('Could not send cache-blocking headers for request! (url: %s, user: %s)', _.originalUrl, _.username);
	}
	next();
};
