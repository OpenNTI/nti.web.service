'use strict';
const path = require('path');

module.exports = function getApplication(pkg) {
	const base = require.main && path.dirname(require.main.filename);
	const tip = `Relative modules are relative to: ${base}`;

	try {
		const { __mockResolve, ...data } = require.main.require(pkg);

		const { resolve = __mockResolve } = require.main.exports;

		return {
			...data,
			file: resolve && resolve(pkg),
		};
	} catch (e) {
		throw new Error(
			`Could not resolve package (${pkg}) for app. ${tip}\n${e.stack}`
		);
	}
};
