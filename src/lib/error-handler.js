'use strict';
const fs = require('fs');
const path = require('path');

const uuid = require('uuid/v4');

const logger = require('./logger');

const basepathreplace = /(manifest|src|href)="(.*?)"/igm;

const isRootPath = RegExp.prototype.test.bind(/^\/(?!\/).*/);

let template = '';

const self = Object.assign(exports, {
	setupErrorHandler,
	middleware,
	preprocess
});


function setupErrorHandler (express/*, config*/) {
	const basePath = express.mountpath || '/';

	//Fail fast, if readFileSync throws, it will halt node.
	//Second, keep this in memory once, no need to read it from disk every time.
	let file = path.resolve(__dirname, '..', 'templates', 'error.html');

	template = fs.readFileSync(file, 'utf8')
						.replace(basepathreplace, (original, attr, val) =>
							attr + '="' + (isRootPath(val) ? (basePath + val.substr(1)) : val) + '"');

	// We need the signature to be 4 args long
	// for express to treat it as a error handler
	express.use(self.middleware);
}


function middleware (err, req, res, next) { // eslint-disable-line no-unused-vars
	if (!err) {
		err = 'Unknown Error';
	}
	else if (err === 'aborted') {
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

	let errorid = uuid();
	logger.error(errorid, err);

	let body;

	try {
		let data = {
			err,
			errorid
		};

		body = self.preprocess(template, data);
	} catch (er) {
		logger.error(errorid,
			/* istanbul ignore next */
			(er.stack || er.message || er)
		);
		body = 'Couldn\'t populate error template.';
	}

	try {
		res.status(err.statusCode || 500).send(body);
	} catch (e) {
		//socket closed... oh well.
	}
}



function preprocess (templateStr, data) {
	Object.keys(data).forEach(key => {
		templateStr = templateStr.replace('{' + key + '}', data[key] || '');
	});

	// strip remaining placeholders before returning the result.
	return templateStr.replace(/\{.*\}/g, '');

}
