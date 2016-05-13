'use strict';
const WantsCompressed = /gzip/i;

const mimes = require('mime-types');
const compressible = require('compressible');
const compression = require('compression');

const path = require('path');
const Url = require('url');
const fs = require('fs');

module.exports = function attachToExpress (expressApp, assetPath) {

	expressApp.all('*', function (req, res, next) {
		let ext = path.extname(Url.parse(req.url).pathname);
		let gz = req.url + '.gz';

		let type = mimes.lookup(ext);

		let compress = WantsCompressed.test(req.header('accept-encoding') || '');
		if (!compress) {
			return next();
		}

		fs.access(path.join(assetPath, gz), fs.R_OK, (err) => {
			if (err) {
				return next();
			}

			req.url = gz;
			res.set('Content-Encoding', 'gzip');
			if (type) {
				res.set('Content-Type', type);
			}

			next();
		});
	});


	expressApp.use(compression({
		filter (req, res) {
			let type = res.getHeader('Content-Type');
			let isGz = path.extname(Url.parse(req.url).pathname) === '.gz';

			if (isGz || (type !== undefined && !compressible(type))) {
				//logger.debug('Not compressing: %s %s ', req.url, type);
				return false;
			}

			return true;
		}
	}));
};
