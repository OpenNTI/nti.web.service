'use strict';
const path = require('path');
const fs = require('fs');

const logger = require('../logger');
const {getStackOrMessage} = require('../utils');

const wrapfs = (method, ...locked) =>
	(...args) => new Promise((fulfill, rej) =>
		fs[method](...[...args, ...locked], (er, data) =>
			er ? rej(er) : fulfill(data)
		)
	);

const stat = wrapfs('stat');
const read = wrapfs('readFile', 'utf8');


function getCached (key) {
	const cache = getCached.cache || (getCached.cache = {});
	return cache[key] || (cache[key] = {});
}


async function getTemplate (assets, devmode) {
	const file = (devmode || {}).template || (assets && path.resolve(assets, './page.html'));
	const cache = getCached(file);
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

		logger.info('template loaded (file: %s, length: %s)', file, data && data.length);
		cache.data = data;
		return data;

	} catch(er) {
		logger.error('%s', getStackOrMessage(er));
		return 'Could not load page template.';
	}
}


//not needed in webpack4:
async function getModules (assets) {
	const unwrap = x => Array.isArray(x) ? x[0] : x;

	if (!assets) {
		return {};
	}

	const file = path.resolve(assets, '../compile-data.json');
	const cache = getCached(file);

	try {
		const {mtime} = await stat(file);

		logger.debug('compile data (%s) mtime: %o', file, mtime);
		if (cache.mtime === mtime.getTime()) {
			return cache.chunks;
		}

		cache.mtime = mtime.getTime();
		logger.info('new compile data (%s), loading...', file);

		const data = JSON.parse(await read(file));
		logger.debug('%s loaded: %o', file, data);

		const chunks = data.assetsByChunkName;

		for (let chunk of Object.keys(chunks)) {
			chunks[chunk] = unwrap(chunks[chunk]);
		}

		logger.info('%s: updated module data: %o', file, chunks);
		cache.chunks = chunks;
		return chunks;
	} catch (e) {
		logger.debug('Failed to load compile data. %s, because: %o', file, getStackOrMessage(e));
		return {};
	}
}


Object.assign(exports, {
	getModules,//not needed in webpack4
	getTemplate,
});
