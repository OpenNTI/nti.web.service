'use strict';

Object.assign(exports, {
	htmlAcceptsFilter,
});

function htmlAcceptsFilter(req, res, next) {
	if (!req.accepts('html')) {
		return res.status(406).send('Not Acceptable');
	}

	next();
}
