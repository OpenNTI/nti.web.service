'use strict';
const path = require('path');

const redirects = require('./lib/redirects');
const sessionSetup = require('./lib/session-setup');

exports = module.exports = {
	register(expressApp, config) {
		redirects.register(expressApp, config);

		expressApp.use((req, res, next) => {
			const { breakme } = req.query || {};

			if (breakme === 'softly') {
				res.write('Hi, you broke.');
			} else if (breakme === 'now') {
				res.send('Hi, you broke.');
			} else if (breakme) {
				return next(new Error('well...shoot'));
			}

			next();
		});

		return {
			devmode: false,

			assets: path.join(__dirname, 'assets'),

			sessionSetup,
		};
	},
};
