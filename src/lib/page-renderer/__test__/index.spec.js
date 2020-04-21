/*eslint-env jest*/
'use strict';
jest.mock('fs');

const unTab = x => (x[0].trim().replace(/\t+/g, ''));

describe('lib/page-renderer (index)', () => {

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();
		const logger = require('../../logger');
		const stub = (a, b, c) => jest.spyOn(a, b).mockImplementation(c || (() => { }));

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

	test('getRenderer', () => {
		const fn = require('../index').getRenderer;
		expect(fn).toEqual(expect.any(Function));
		expect(fn.length).toEqual(3);

		const render = fn('/test/');
		expect(render).toEqual(expect.any(Function));
	});


	test('render (Bad Template)', async () => {
		const fs = require('fs').promises;
		const fn = require('../index').getRenderer;

		jest.spyOn(fs, 'stat').mockImplementation(async (f) => ({ mtime: new Date('2018-04-02T16:35:42.000Z') }));
		jest.spyOn(fs, 'readFile').mockImplementation(async (f) => '');

		expect(fn).toEqual(expect.any(Function));
		expect(fn.length).toEqual(3);


		const render = fn('/test/');
		const result = await render('/');
		expect(result).toEqual('Bad Template');
	});

	describe('Variables', () => {
		const fs = require('fs').promises;
		const fn = require('../index').getRenderer;

		jest.spyOn(fs, 'stat').mockImplementation(async (f) => ({ mtime: new Date('2018-04-02T16:35:42.000Z') }));

		beforeEach(() => jest.clearAllMocks());

		test('CDATA style', async () => {
			jest.spyOn(fs, 'readFile').mockImplementation(async (f) => `
				<![CDATA[cfg:title]]>
				<![CDATA[cfg:title|html]]>
				<![CDATA[cfg:title|string]]>
			`);


			const render = fn('/test/');
			const result = await render('/', {}, { config: { title: 'Kibbles \'n Bits' } });
			expect(result).toEqual(`
				Kibbles &apos;n Bits
				Kibbles &apos;n Bits
				Kibbles \\'n Bits
			`);
		});

		test('inline style', async () => {
			jest.spyOn(fs, 'readFile').mockImplementation(async (f) => `
				<[cfg:title]>
				<[cfg:title|html]>
				<[cfg:title|string]>
			`);


			const render = fn('/test/');
			const result = await render('/', {}, { config: { title: 'Kibbles \'n Bits' } });
			expect(result).toEqual(`
				Kibbles &apos;n Bits
				Kibbles &apos;n Bits
				Kibbles \\'n Bits
			`);
		});
	});


	// test ('render (root path rewrite)');
	// test ('render (config value injection)');
	// test ('render (custom content renderer)');

});
