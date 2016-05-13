'use strict';
const logger = require('./logger');

const unknown = {name: 'default', title: 'nextthought'};

module.exports = function getSite (map, site) {
	let s = map[site] || unknown;

	if (typeof s === 'string') {
		return getSite(map, s);
	}

	if (s === unknown) {
		logger.warn('No site-mapping entry found for %s.', site);
	}
	return s;
};
