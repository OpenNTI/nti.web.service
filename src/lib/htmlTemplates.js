'use strict';
const fs = require('fs');

module.exports = exports = function (filePath, options, callback) {

	const configValues = /\{([^}]*)\}/igm;
	const injectValues = (cfg, original, prop) => cfg[prop] || original;

	function readFileCallback (err, content) {
		if (err) {
			return callback(err);
		}

		// this is an extremely simple template engine
		const rendered = content.toString()
			.replace(configValues, injectValues.bind(this, options));

		return callback(null, rendered);
	}

	fs.readFile(filePath, readFileCallback);
};
