/*eslint-env jest*/
'use strict';

jest.mock('fs');

describe('lib/page-renderer (utils)', () => {

	beforeEach(() => {
		jest.resetModules();
	});


	afterEach(() => {
		jest.resetModules();
	});

	test ('resolveTemplateFile', () => {

		const fn = require('../utils').resolveTemplateFile;

		expect(fn).toEqual(expect.any(Function));
		expect(fn.length).toEqual(1);

		expect(fn('/test/')).toEqual('/test/page.html');
	});

	test ('getTemplate (base line: caches template)', async () => {
		const fs = require('fs');
		const fn = require('../utils').getTemplate;

		const file = 'test/page.html';
		const contents = {
			[file]: 'file contents'
		};

		expect(fn).toEqual(expect.any(Function));
		expect(fn.length).toEqual(1);

		jest.spyOn(fs, 'stat').mockImplementation((f, cb) => cb(null, {mtime: new Date('2018-04-02T16:35:42.000Z')}));
		jest.spyOn(fs, 'readFile').mockImplementation((f, _, cb) => cb(null, contents[f]));

		//first pass... cache should be cold.
		let page = await fn(file);

		expect(fs.stat).toHaveBeenCalledTimes(1);
		expect(fs.stat).toHaveBeenCalledWith(file, expect.any(Function));
		expect(fs.readFile).toHaveBeenCalledTimes(1);
		expect(fs.readFile).toHaveBeenCalledWith(file, 'utf8', expect.any(Function));
		expect(page).toEqual(contents[file]);

		fs.stat.mockClear();
		fs.readFile.mockClear();

		//second pass... cache should warm, and should hit.
		page = await fn(file);

		expect(page).toEqual(contents[file]);
		expect(fs.stat).toHaveBeenCalledTimes(1);
		expect(fs.stat).toHaveBeenCalledWith(file, expect.any(Function));
		expect(fs.readFile).not.toHaveBeenCalled();

		fs.stat.mockClear();
		fs.readFile.mockClear();

		//third pass cache should be invalidated by modtime... and produce a cache miss.
		jest.spyOn(fs, 'stat').mockImplementation((f, cb) => cb(null, {mtime: new Date('2018-04-02T16:55:42.000Z')}));
		page = await fn(file);

		expect(fs.stat).toHaveBeenCalledTimes(1);
		expect(fs.stat).toHaveBeenCalledWith(file, expect.any(Function));
		expect(fs.readFile).toHaveBeenCalledTimes(1);
		expect(fs.readFile).toHaveBeenCalledWith(file, 'utf8', expect.any(Function));
		expect(page).toEqual(contents[file]);
	});

	test ('getTemplate (muliple templates)', async () => {
		const fs = require('fs');
		const fn = require('../utils').getTemplate;

		const contents = {
			'test1/page.html': 'file1 contents',
			'test2/page.html': 'file2 contents',
			'test3/page.html': 'file3 contents',
		};

		jest.spyOn(fs, 'stat').mockImplementation((f, cb) => cb(null, {mtime: new Date('2018-04-02T16:35:42.000Z')}));
		jest.spyOn(fs, 'readFile').mockImplementation((f, _, cb) => cb(null, contents[f]));

		for (let file of Object.keys(contents)) {
			let page = await fn(file);
			expect(page).toEqual(contents[file]);
		}
	});

});
