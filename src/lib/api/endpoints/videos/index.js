'use strict';
const { default: YouTube } = require('./youtube');

const HANDLERS = [YouTube];

exports.default = function registerVideoDataProviders(
	api,
	config,
	routeFactory
) {
	const videos = routeFactory(/^\/videos/i, api);

	for (let handler of HANDLERS) {
		handler(videos, config);
	}
};
