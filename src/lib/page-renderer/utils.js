const path = require('path');
const fs = require('fs');

const logger = require('../logger');

//not needed in webpack4:
const statCache = {};
const COMPILE_DATA = '../compile-data.json';

const templateCache = {};
const TEMPLATE = './page.html';

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


//not needed in webpack4:
async function getModules (assets) {
	const unwrap = x => Array.isArray(x) ? x[0] : x;

	if (!assets) {
		return {};
	}

	const file = path.resolve(assets, COMPILE_DATA);
	const cache = statCache[file] || (statCache[file] = {});

	try {
		const {mtime} = await stat(file);

		logger.debug('compile data mtime:', mtime);
		if (cache.mtime === mtime.getTime()) {
			return cache.chunks;
		}

		logger.debug('new compile data, loading...');

		const data = JSON.parse(await read(file));

		logger.debug('data loaded? %s', !!data);
		const chunks = data.assetsByChunkName;

		for (let chunk of Object.keys(chunks)) {
			chunks[chunk] = unwrap(chunks[chunk]);
		}

		logger.debug('updated module data: %o', chunks);
		cache.chunks = chunks;
		return chunks;
	} catch (e) {
		logger.warn('Failed to load compile data. %s', file);
		return {};
	}
}


Object.assign(exports, {
	getModules,//not needed in webpack4
	getTemplate,
	resolveTemplateFile
});

