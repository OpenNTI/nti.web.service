'use strict';
const fs = require('fs');

module.exports = exports = function (filePath, options, callback) {

	const configValues = /\{([^}\n\s]*)\}/igm;
	const injectValues = (cfg, original, prop) =>
		prop in cfg ? cfg[prop] : `MissingTemplateValue: ${original}`;

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
