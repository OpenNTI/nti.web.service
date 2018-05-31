/*eslint-env jest*/
'use strict';
const path = require('path');

jest.mock('fs');

describe('lib/page-renderer (utils)', () => {

	beforeEach(() => {
		jest.resetModules();
		const logger = require('../../logger');
		const stub = (a, b, c) => jest.spyOn(a, b).mockImplementation(c || (() => {}));

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


	test ('getTemplate (io failure)', async () => {
		const fs = require('fs');
		const fn = require('../utils').getTemplate;

		const assets = path.resolve('test');
		const file = path.join(assets, './page.html');
		const failure = 'Could not load page template.';

		expect(fn).toEqual(expect.any(Function));

		jest.spyOn(fs, 'stat').mockImplementation((f, cb) => cb(new Error(), null));
		jest.spyOn(fs, 'readFile').mockImplementation((f, _, cb) => cb(new Error(), null));

		//first pass... cache should be cold.
		let page = await fn(assets);

		expect(fs.stat).toHaveBeenCalledTimes(1);
		expect(fs.stat).toHaveBeenCalledWith(file, expect.any(Function));
		expect(fs.readFile).not.toHaveBeenCalled();
		expect(page).toEqual(failure);

		fs.stat.mockClear();
		fs.readFile.mockClear();
		jest.spyOn(fs, 'stat').mockImplementation((f, cb) => cb(null, {mtime: new Date('2018-04-02T16:35:42.000Z')}));

		//second pass... cache should warm, and should hit.
		page = await fn(assets);

		expect(fs.stat).toHaveBeenCalledTimes(1);
		expect(fs.stat).toHaveBeenCalledWith(file, expect.any(Function));
		expect(fs.readFile).toHaveBeenCalledTimes(1);
		expect(fs.readFile).toHaveBeenCalledWith(file, 'utf8', expect.any(Function));
		expect(page).toEqual(failure);
	});


	test ('getTemplate (base line: caches template)', async () => {
		const fs = require('fs');
		const fn = require('../utils').getTemplate;

		const assets = path.resolve('test');
		const file = path.join(assets, './page.html');
		const contents = {
			[file]: 'file contents'
		};

		expect(fn).toEqual(expect.any(Function));

		jest.spyOn(fs, 'stat').mockImplementation((f, cb) => cb(null, {mtime: new Date('2018-04-02T16:35:42.000Z')}));
		jest.spyOn(fs, 'readFile').mockImplementation((f, _, cb) => cb(null, contents[f]));

		//first pass... cache should be cold.
		let page = await fn(assets);

		expect(fs.stat).toHaveBeenCalledTimes(1);
		expect(fs.stat).toHaveBeenCalledWith(file, expect.any(Function));
		expect(fs.readFile).toHaveBeenCalledTimes(1);
		expect(fs.readFile).toHaveBeenCalledWith(file, 'utf8', expect.any(Function));
		expect(page).toEqual(contents[file]);

		fs.stat.mockClear();
		fs.readFile.mockClear();

		//second pass... cache should warm, and should hit.
		page = await fn(assets);

		expect(fs.stat).toHaveBeenCalledTimes(1);
		expect(fs.stat).toHaveBeenCalledWith(file, expect.any(Function));
		expect(fs.readFile).not.toHaveBeenCalled();
		expect(page).toEqual(contents[file]);

		fs.stat.mockClear();
		fs.readFile.mockClear();

		//third pass cache should be invalidated by modtime... and produce a cache miss.
		jest.spyOn(fs, 'stat').mockImplementation((f, cb) => cb(null, {mtime: new Date('2018-04-02T16:55:42.000Z')}));
		page = await fn(assets);

		expect(fs.stat).toHaveBeenCalledTimes(1);
		expect(fs.stat).toHaveBeenCalledWith(file, expect.any(Function));
		expect(fs.readFile).toHaveBeenCalledTimes(1);
		expect(fs.readFile).toHaveBeenCalledWith(file, 'utf8', expect.any(Function));
		expect(page).toEqual(contents[file]);
	});


	test ('getTemplate (base line: devmode template)', async () => {
		const fs = require('fs');
		const fn = require('../utils').getTemplate;

		const assets = path.resolve('test');
		const devmode = path.resolve('devmode');
		const file = path.join(assets, './page.html');
		const dfile = path.join(devmode, './page.html');

		const contents = {
			[file]: 'file contents',
			[dfile]: 'dev-template'
		};

		const args = [assets, {template: dfile}];

		expect(fn).toEqual(expect.any(Function));

		jest.spyOn(fs, 'stat').mockImplementation((f, cb) => cb(null, {mtime: new Date('2018-04-02T16:35:42.000Z')}));
		jest.spyOn(fs, 'readFile').mockImplementation((f, _, cb) => cb(null, contents[f]));

		//first pass... cache should be cold.
		let page = await fn(...args);

		expect(fs.stat).toHaveBeenCalledTimes(1);
		expect(fs.stat).toHaveBeenCalledWith(dfile, expect.any(Function));
		expect(fs.readFile).toHaveBeenCalledTimes(1);
		expect(fs.readFile).toHaveBeenCalledWith(dfile, 'utf8', expect.any(Function));
		expect(page).toEqual(contents[dfile]);

		fs.stat.mockClear();
		fs.readFile.mockClear();

		//second pass... cache should warm, and should hit.
		page = await fn(...args);

		expect(fs.stat).toHaveBeenCalledTimes(1);
		expect(fs.stat).toHaveBeenCalledWith(dfile, expect.any(Function));
		expect(fs.readFile).not.toHaveBeenCalled();
		expect(page).toEqual(contents[dfile]);

		fs.stat.mockClear();
		fs.readFile.mockClear();

		//third pass cache should be invalidated by modtime... and produce a cache miss.
		jest.spyOn(fs, 'stat').mockImplementation((f, cb) => cb(null, {mtime: new Date('2018-04-02T16:55:42.000Z')}));
		page = await fn(...args);

		expect(fs.stat).toHaveBeenCalledTimes(1);
		expect(fs.stat).toHaveBeenCalledWith(dfile, expect.any(Function));
		expect(fs.readFile).toHaveBeenCalledTimes(1);
		expect(fs.readFile).toHaveBeenCalledWith(dfile, 'utf8', expect.any(Function));
		expect(page).toEqual(contents[dfile]);
	});


	test ('getTemplate (muliple templates)', async () => {
		const fs = require('fs');
		const fn = require('../utils').getTemplate;

		const gen = (x) => Array.from({length: x})
			.map((_, i) => ({
				[path.resolve(`test${i}/page.html`)]: `file${i} contents`
			}))
			.reduce((a, b) => ({...a, ...b}), {});

		const contents = {
			...gen(4)
		};

		expect(contents).not.toEqual({});

		jest.spyOn(fs, 'stat').mockImplementation((f, cb) => cb(null, {mtime: new Date('2018-04-02T16:35:42.000Z')}));
		jest.spyOn(fs, 'readFile').mockImplementation((f, _, cb) => cb(null, contents[f]));

		for (let file of Object.keys(contents)) {
			expect(await fn(path.dirname(file))).toEqual(contents[file]);
		}
	});
});
