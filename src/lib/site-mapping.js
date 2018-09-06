'use strict';
const logger = require('./logger');

const unknown = {name: 'default', title: 'nextthought'};

const warned = {};

module.exports = function getSite (map, site) {
	map = map || {};
	const visited = [];
	let s = site;

	do {
		visited.push(s);
		s = map[s] || unknown;
		if (typeof s === 'string' && visited.includes(s)) {
			logger.warn('Cycle in alias: %s -x-> %s <=', visited.join(' -> '), s);
			s = unknown;
		}
	} while (typeof s === 'string');

	if (s === unknown && !warned[site]) {
		warned[site] = true;
		logger.warn('No site-mapping entry found for %s.', site);
	}

	return s !== unknown
		? s
		: {...s, name: site || s.name};
};
