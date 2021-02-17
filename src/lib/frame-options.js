'use strict';
module.exports = function middleware(req, res, next) {
	res.setHeader('X-Frame-Options', 'SAMEORIGIN');
	next();
};
