'use strict';
const wantsCompressed = RegExp.prototype.test.bind(/gzip/i);

const path = require('path');
const url = require('url');
const fs = require('fs');

const mimes = require('mime-types');
const compression = require('compression');


const self = Object.assign(exports, {
	attachToExpress,
	precompressed,
	compressionFilter
});


function attachToExpress (expressApp, assetPath) {

	expressApp.use(self.precompressed(assetPath));

	expressApp.use(compression({filter: self.compressionFilter}));
}


function compressionFilter (req, res) {
	const isGz = path.extname(url.parse(req.url).pathname) === '.gz';
	const blocked = !!req.get('x-no-compression');

	if (blocked || isGz) {
		return false;
	}

	return compression.filter(req, res);
}


function precompressed (assetPath) {
	return function (req, res, next) {
		const gz = req.url + '.gz';
		const blocked = !!req.get('x-no-compression');
		const compress = wantsCompressed(req.get('accept-encoding') || '');

		if (blocked || !compress) {
			return next();
		}

		fs.access(path.join(assetPath, gz), fs.R_OK, (err) => {
			if (err) {
				return next();
			}

			const ext = path.extname(url.parse(req.url).pathname);
			const type = mimes.lookup(ext);

			req.url = gz;
			res.set('Content-Encoding', 'gzip');
			if (type) {
				res.set('Content-Type', type);
			}

			next();
		});
	};
}
