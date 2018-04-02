/*eslint-env jest*/
'use strict';

describe('lib/page-renderer (index)', () => {

	beforeEach(() => {
		jest.resetModules();
	});


	afterEach(() => {
		jest.resetModules();
	});

	test ('getRenderer', () => {
		const fn = require('../index').getRenderer;
		expect(fn).toEqual(expect.any(Function));
		expect(fn.length).toEqual(3);

		const render = fn('/test/');
		expect(render).toEqual(expect.any(Function));
	});

});
