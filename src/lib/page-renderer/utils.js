const path = require('path');
const fs = require('fs');

const logger = require('../logger');

const templateCache = {};
const TEMPLATE = './page.html';

function exists (f) {
	try {
		fs.accessSync(f);
	} catch (e) {
		return false;
	}
	return true;
}

const wrapfs = (method, ...locked) =>
	(...args) => new Promise((fulfill, rej) =>
		fs[method](...[...args, ...locked], (er, data) =>
			er ? rej(er) : fulfill(data)
		)
	);

const stat = wrapfs('stat');
const read = wrapfs('readFile', 'utf8');



function resolveTemplateFile (assets) {
	return assets ? path.resolve(assets, TEMPLATE) : null;
}


async function getTemplate (file) {
	const cache = templateCache[file] || (templateCache[file] = {});
	logger.debug('Checking Template: %s', file);

	try {
		const {mtime} = await stat(file);

		logger.debug('template mtime: ', mtime);
		if (cache.mtime === mtime.getTime()) {
			logger.debug('template not modified');
			return cache.data;
		}

		cache.mtime = mtime.getTime();
		const data = await read(file);

		logger.debug('template loaded (length: %s)', data.length);
		cache.data = data;
		return data;

	} catch(er) {
		logger.error('%s', er.stack || er.message || er);
		return 'Could not load page template.';
	}
}

Object.assign(exports, {
	exists,
	getTemplate,
	resolveTemplateFile
});
