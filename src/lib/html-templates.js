'use strict';
const fs = require('fs');

const { applyInjections } = require('./page-renderer/utils');

const configValues = /<(!\[CDATA)?\[cfg:([^\]]*)\]\]?>/gim;
const fillInValues = (cfg, original, _, prop) =>
	cfg[prop] === null ? '' : cfg[prop] || `MissingConfigValue[${prop}]`;

module.exports = exports = function (filePath, options, callback) {
	function readFileCallback(err, content) {
		if (err) {
			return callback(err);
		}

		content = content.toString();

		if (options.templateInjections) {
			content = applyInjections(
				{ data: content },
				options.templateInjections
			);
		}

		// this is an extremely simple template engine
		const rendered = content
			//support config placeholders too
			.replace(configValues, fillInValues.bind(this, options));

		return callback(null, rendered);
	}

	fs.readFile(filePath, readFileCallback);
};
