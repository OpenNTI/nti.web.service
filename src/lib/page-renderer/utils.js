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


async function readFile (file) {
	const cache = getCached(file);
	logger.debug('Checking Template: %s', file);

	const {mtime} = await stat(file);

	logger.debug('template mtime: ', mtime);
	if (cache.mtime === mtime.getTime()) {
		logger.debug('template not modified');
		return cache;
	}

	for (const key of Object.keys(cache)) {
		delete cache[key];
	}

	cache.mtime = mtime.getTime();
	const data = await read(file);

	logger.info('template loaded (file: %s, length: %s)', file, data && data.length);
	cache.data = data;
	return cache;
}

function inject (html, tagName, position, content) {
	const ALLOWED_TAGNAMES = {
		head: 1,
		body: 1,
	};

	if (!ALLOWED_TAGNAMES[tagName]) {
		throw new Error(`TagName (${tagName}) not allowed!`);
	}

	const re = position === 'start'
		? new RegExp('(<' + tagName + '[^>]*>)', 'igm')
		: new RegExp('(</' + tagName + '[^>]*>)', 'igm');

	const fn = position === 'start'
		? (_, tag) => (tag + content)
		: (_, tag) => (content + tag);

	return html.replace(re, fn);
}

function applyInjections (template, injections) {
	if (!template.injected && injections) {
		let {data: html} = template;

		for (const [tagName, injection] of Object.entries(injections)) {
			for (const [position, {content}] of Object.entries(injection)) {
				html = inject(html, tagName, position, content);
			}
		}

		template.injected = html;
	}

	return template.injected || template.data;
}

async function getTemplate (assets, injections, devmode) {
	const file = (devmode || {}).template || (assets && path.resolve(assets, './page.html'));

	try {

		let cache = await readFile(file);

		if(injections) {
			return applyInjections(cache, injections);
		}

		return cache.data;

	} catch(er) {
		logger.error('%s', getStackOrMessage(er));
		return 'Could not load page template.';
	}
}


Object.assign(exports, {
	getTemplate,
});
