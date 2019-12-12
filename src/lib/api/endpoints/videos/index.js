'use strict';
const express = require('express');

const {default: YouTube} = require('./youtube');

const HANDLERS = [
	YouTube
];

exports.default = function registerVideoDataProviders (api, config) {
	const videos = express();
	api.use(/^\/videos/i, videos);

	for (let handler of HANDLERS) {
		handler(videos, config);
	}

};
