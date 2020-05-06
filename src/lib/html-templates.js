'use strict';
const fs = require('fs');

const {applyInjections} = require('./page-renderer/utils');

const configValues = /<(!\[CDATA)?\[cfg:([^\]]*)\]\]?>/igm;
const fillInValues = (cfg, orginal, _, prop) => cfg[prop] === null ? '' : (cfg[prop] || `MissingConfigValue[${prop}]`);

module.exports = exports = function (filePath, options, callback) {

	const runtimeValues = /\{([a-z0-9]+)\}/igm;
	const injectValues = (cfg, original, prop) =>
		prop in cfg ? cfg[prop] : `MissingTemplateValue: ${original}`;

	function readFileCallback (err, content) {
		if (err) {
			return callback(err);
		}

		content = content.toString();

		if (options.templateInjections) {
			content = applyInjections({data: content}, options.templateInjections);
		}

		// this is an extremely simple template engine
		const rendered = content
			.replace(runtimeValues, injectValues.bind(this, options))
			//support config placeholders too
			.replace(configValues, fillInValues.bind(this, options));

		return callback(null, rendered);
	}

	fs.readFile(filePath, readFileCallback);
};
