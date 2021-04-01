'use strict';
module.exports = () => module.exports;
Object.assign(module.exports, {
	default: module.exports,
	enable() {},
	load() {},
});
