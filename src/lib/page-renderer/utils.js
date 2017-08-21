const path = require('path');
const fs = require('fs');

const logger = require('../logger');
const {restart: askToRestart} = require('../restart');

const statCache = {};
const templateCache = {};
const COMPILE_DATA = '../compile-data.json';
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
const unwrap = x => Array.isArray(x) ? x[0] : x;


let askToRestartOnce = () => {
	askToRestart();
	askToRestartOnce = () => {};
};



function resolveTemplateFile (assets) {
	return assets ? path.resolve(assets, TEMPLATE) : null;
}


function getModules (assets) {
	if (!assets) {
		return Promise.reject('No assets path');
	}

	const file = path.resolve(assets, COMPILE_DATA);
	logger.debug('Checking for compile data: %s', file);
	return stat(file)
		.then(({mtime}) => {
			const cache = statCache[file] || (statCache[file] = {});

			logger.debug('compile data mtime:', mtime);
			if (cache.mtime === mtime.getTime()) {
				logger.debug('compile data not modified');
				return cache.chunks;
			}

			logger.debug('new compile data, loading...');

			if (cache.mtime) {
				if (cache.watcher) {
					cache.watcher.close();
				}
				askToRestartOnce(); //allow the current process to finish, then cleanly restart.
			}

			cache.mtime = mtime.getTime();
			cache.watcher = cache.watcher || fs.watch(file, {persistent: false}, askToRestartOnce);

			return read(file)
				.then(JSON.parse)
				.then(data => {
					logger.debug('data loaded? %s', !!data);
					const chunks = data.assetsByChunkName;

					for (let chunk of Object.keys(chunks)) {
						chunks[chunk] = unwrap(chunks[chunk]);
					}

					logger.debug('updated module data: %o', chunks);
					cache.chunks = chunks;
					return chunks;
				});
		});
}


function getTemplate (file) {
	const cache = templateCache;
	logger.debug('Checking Template: %s', file);

	return stat(file)
		.then(({mtime}) => {
			logger.debug('template mtime: ', mtime);
			if (cache.mtime === mtime.getTime()) {
				logger.debug('template not modified');
				return cache.data;
			}

			cache.mtime = mtime.getTime();
			return read(file)
				.then(data => {
					logger.debug('template loaded (length: %s)', data.length);
					cache.data = data;
					return data;
				});
		})
		.catch(er => {
			logger.error('%s', er.stack || er.message || er);
			return 'Could not load page template.';
		});
}

Object.assign(exports, {
	askToRestart,
	exists,
	getModules,
	getTemplate,
	resolveTemplateFile
});
