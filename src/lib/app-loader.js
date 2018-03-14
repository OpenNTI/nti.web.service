'use strict';
const path = require('path');

module.exports = function getApplication (pkg) {
	const base = require.main && path.dirname(require.main.filename);
	const tip = `Relative modules are relative to: ${base}`;

	try {
		if (!require.main && process.env.NODE_ENV === 'test') {
			return require(pkg);
		}

		const {resolve} = require.main.exports;

		return {
			...require.main.require(pkg),
			file: resolve && resolve(pkg)
		};
	} catch (e) {
		throw new Error(`Could not resolve package (${pkg}) for app. ${tip}\n${e.stack}`);
	}
};
