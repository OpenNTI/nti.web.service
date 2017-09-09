'use strict';
const uuid = require('uuid/v4');

const logger = require('./logger');


const self = Object.assign(exports, {
	setupErrorHandler,
	middleware,
});


function setupErrorHandler (express/*, config*/) {
	express.use(self.middleware);
}


// We need the signature to be 4 args long
// for express to treat it as a error handler
// eslint-disable-next-line no-unused-vars
function middleware (err, req, res, next) {
	if (!err) {
		err = 'Unknown Error';
	}
	else if (err === 'aborted') {
		if (res.headersSent) {
			return;
		}

		return res.status(204).end();
	}
	else if (err.statusCode === 503 || err.message === 'Service Unavailable') {
		return res.status(503).send(err.message);
	}
	else if (err.toJSON) {
		err = err.toJSON();
	}
	else if (err.stack) {
		err = err.stack;
	}

	const errorid = uuid();
	logger.error(errorid, err);

	const data = {
		err,
		errorid,
		contact: '',
		message: ''
	};

	try {
		res.status(err.statusCode || 500).render('error', data);
	} catch (e) {
		//socket closed... oh well.
	}
}
