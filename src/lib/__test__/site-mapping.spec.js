/*eslint-env jest*/
'use strict';

const stub = (a, b, c) => jest.spyOn(a, b).mockImplementation(c || (() => {}));

const siteMap = {
	site1Alias1: 'site1',
	site1Alias2: 'site1Alias1',
	badAlias: 'someNonExistingKey',
	aliasBadCycle: 'aliasBadCycle2',
	aliasBadCycle1: 'aliasBadCycle2',
	aliasBadCycle2: 'aliasBadCycle1',
	site1: {
		title: 'This is Sparta!',
		name: 'sparta'
	}
};

describe('lib/site-mapping', () => {
	let logger;

	beforeEach(() => {
		jest.resetModules();
		logger = require('../logger');

		stub(logger, 'get', () => logger);
		stub(logger, 'attachToExpress');
		stub(logger, 'debug');
		stub(logger, 'error');
		stub(logger, 'info');
		stub(logger, 'warn');
	});


	afterEach(() => {
		jest.resetModules();
	});

	test ('exports a function', () => {
		const fn = require('../site-mapping');

		expect(fn).toEqual(expect.any(Function));
		expect(fn.length).toEqual(2);
	});

	test ('returns defaults', () => {
		const fn = require('../site-mapping');

		expect(fn(siteMap, 'bla')).toEqual({name: 'bla', title: 'nextthought'});

		expect(fn(siteMap, 'badAlias')).toEqual({name: 'badAlias', title: 'nextthought'});

		expect(fn(siteMap)).toHaveProperty('name', 'default');

		expect(fn()).toHaveProperty('name', 'default');

		expect(logger.warn).toHaveBeenCalledTimes(3);
		expect(logger.warn).toHaveBeenCalledWith('No site-mapping entry found for %s.', 'bla');
		expect(logger.warn).toHaveBeenCalledWith('No site-mapping entry found for %s.', 'badAlias');
		expect(logger.warn).toHaveBeenCalledWith('No site-mapping entry found for %s.', undefined);
	});

	test ('returns named entry', () => {
		const fn = require('../site-mapping');

		expect(fn(siteMap, 'site1')).toEqual(siteMap.site1);
	});

	test ('returns aliased entry', () => {
		const fn = require('../site-mapping');

		expect(fn(siteMap, 'site1Alias1')).toEqual(siteMap.site1);
		expect(fn(siteMap, 'site1Alias2')).toEqual(siteMap.site1);
	});

	test ('returns default for cycled alias', () => {
		const fn = require('../site-mapping');

		expect(fn(siteMap, 'aliasBadCycle')).toEqual({name: 'aliasBadCycle', title: 'nextthought'});

		expect(logger.warn).toHaveBeenCalledWith('Cycle in alias: %s -x-> %s <=', expect.any(String), expect.any(String));
		expect(logger.warn).toHaveBeenCalledWith('No site-mapping entry found for %s.', 'aliasBadCycle');
	});
});
