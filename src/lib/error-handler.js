'use strict';
const uuid = require('uuid');

const logger = require('./logger');
const UNKNOWN = 'Unknown Error';

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
	if (err === 'aborted' || err?.error?.type === 'aborted') {
		if (res.headersSent) {
			return;
		}

		return res.status(204).end();
	}

	if (!err) {
		err = UNKNOWN;
	}

	const { message = err.Message || UNKNOWN } = err;

	if (message === 'Service Unavailable') {
		return res.status(503).send(message);
	}

	// API calls that do not respond in the 200 range abort like errors.
	if (err.statusCode > 300) {
		return res.status(err.statusCode).send(message);
	}

	if (!err.stack && typeof err !== 'string') {
		err = JSON.stringify(err, null, '\t');
	}
	else if (err.stack) {
		err = err.stack;
	}

	const errorId = uuid.v4();
	logger.error(`${errorId} - ${message}
=== error context ===
${err}
---
URL: ${req.originalUrl}
Headers: ${JSON.stringify(req.headers, null, '\t')}
=== error context ===
`);

	const data = {
		err,
		errorid: errorId,
		contact: '',
		message: ''
	};

	try {
		res.status(err.statusCode || 500).render('error', data);
	} catch (e) {
		logger.error(`Could not report error ${errorId} to client.`, e.stack || e.message || e);
		//socket closed... oh well.
	}
}
