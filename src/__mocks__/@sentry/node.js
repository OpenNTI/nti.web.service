'use strict';
module.exports = {
	init() {},
	Handlers: {
		requestHandler: () => (r, s, n) => n(),
		errorHandler: () => (e, r, s, n) => n(e),
	},
};
