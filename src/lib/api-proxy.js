/* eslint import/no-extraneous-dependencies:0 */

'use strict';

const logger = require('./logger');

module.exports = function middleware (config) {
	try {
		const proxy = require('http-proxy-middleware');
		return proxy({target: config.proxy, changeOrigin: true});
	} catch (e) {
		logger.error('http-proxy-middleware must be added to use the proxy config');
		throw e;
	}
};
