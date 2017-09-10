'use strict';
const path = require('path');

module.exports = function getApplication (pkg) {
	try {
		if (!require.main && process.env.NODE_ENV === 'test') {
			return require(pkg);
		}
		return require.main.require(pkg);
	} catch (e) {
		const base = require.main && path.dirname(require.main.filename);
		const tip = `Relative modules are relative to: ${base}`;
		throw new Error(`Could not resolve package (${pkg}) for app. ${tip}`);
	}
};
