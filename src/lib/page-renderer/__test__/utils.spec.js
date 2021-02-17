/*eslint-env jest*/
'use strict';
const path = require('path');

jest.mock('fs');

const HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<title>Document</title>
</head>
<body>
<!--html:server-values-->
</body>
</html>
`;

describe('lib/page-renderer (utils)', () => {
	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();
		const logger = require('../../logger');
		const stub = (a, b, c) =>
			jest.spyOn(a, b).mockImplementation(c || (() => {}));

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

	test('applyInjections()', () => {
		const { applyInjections } = require('../utils');

		const data = {
			data: HTML,
		};

		const injections = {
			head: {
				start: { content: 'A' },
				end: { content: 'B' },
			},
			body: {
				start: { content: 'C' },
			},
		};

		expect(data).not.toHaveProperty('injected');

		const result = applyInjections(data, injections);

		expect(result).toEqual(data.injected);
		expect(result).toMatchInlineSnapshot(`
		"
		<!DOCTYPE html>
		<html lang=\\"en\\">
		<head>A
			<meta charset=\\"UTF-8\\">
			<title>Document</title>
		B</head>
		<body>C
		<!--html:server-values-->
		</body>
		</html>
		"
		`);
	});

	test('getTemplate (io failure)', async () => {
		const fs = require('fs').promises;
		const fn = require('../utils').getTemplate;

		const assets = path.resolve('test');
		const file = path.join(assets, './page.html');
		const failure = 'Could not load page template.';

		expect(fn).toEqual(expect.any(Function));

		jest.spyOn(fs, 'stat').mockImplementation(async f => {
			throw new Error();
		});
		jest.spyOn(fs, 'readFile').mockImplementation(async f => {
			throw new Error();
		});

		//first pass... cache should be cold.
		let page = await fn(assets);

		expect(fs.stat).toHaveBeenCalledTimes(1);
		expect(fs.stat).toHaveBeenCalledWith(file);
		expect(fs.readFile).not.toHaveBeenCalled();
		expect(page).toEqual(failure);

		fs.stat.mockClear();
		fs.readFile.mockClear();
		jest.spyOn(fs, 'stat').mockImplementation(async f => ({
			mtime: new Date('2018-04-02T16:35:42.000Z'),
		}));

		//second pass... cache should warm, and should hit.
		page = await fn(assets);

		expect(fs.stat).toHaveBeenCalledTimes(1);
		expect(fs.stat).toHaveBeenCalledWith(file);
		expect(fs.readFile).toHaveBeenCalledTimes(1);
		expect(fs.readFile).toHaveBeenCalledWith(file, 'utf8');
		expect(page).toEqual(failure);
	});

	test('getTemplate (base line: caches template)', async () => {
		const fs = require('fs').promises;
		const fn = require('../utils').getTemplate;

		const assets = path.resolve('test');
		const file = path.join(assets, './page.html');
		const contents = {
			[file]: 'file contents',
		};

		expect(fn).toEqual(expect.any(Function));

		jest.spyOn(fs, 'stat').mockImplementation(async f => ({
			mtime: new Date('2018-04-02T16:35:42.000Z'),
		}));
		jest.spyOn(fs, 'readFile').mockImplementation(async f => contents[f]);

		//first pass... cache should be cold.
		let page = await fn(assets);
		expect(page).toEqual(contents[file]);

		expect(fs.stat).toHaveBeenCalledWith(file);
		expect(fs.readFile).toHaveBeenCalledWith(file, 'utf8');

		fs.stat.mockClear();
		fs.readFile.mockClear();

		//second pass... cache should warm, and should hit.
		page = await fn(assets);
		expect(page).toEqual(contents[file]);

		expect(fs.stat).toHaveBeenCalledWith(file);
		expect(fs.readFile).not.toHaveBeenCalled();

		fs.stat.mockClear();
		fs.readFile.mockClear();

		//third pass cache should be invalidated by mod time... and produce a cache miss.
		jest.spyOn(fs, 'stat').mockImplementation(async f => ({
			mtime: new Date('2018-04-02T16:55:42.000Z'),
		}));
		page = await fn(assets);
		expect(page).toEqual(contents[file]);

		expect(fs.stat).toHaveBeenCalledWith(file);
		expect(fs.readFile).toHaveBeenCalledWith(file, 'utf8');
	});

	test('getTemplate (base line: devmode template)', async () => {
		const fs = require('fs').promises;
		const fn = require('../utils').getTemplate;

		const assets = path.resolve('test');
		const devmode = path.resolve('devmode');
		const file = path.join(assets, './page.html');
		const dFile = path.join(devmode, './page.html');

		const contents = {
			[file]: 'file contents',
			[dFile]: 'dev-template',
		};

		const args = [assets, void 0, { template: dFile }];

		expect(fn).toEqual(expect.any(Function));

		jest.spyOn(fs, 'stat').mockImplementation(async f => ({
			mtime: new Date('2018-04-02T16:35:42.000Z'),
		}));
		jest.spyOn(fs, 'readFile').mockImplementation(async f => contents[f]);

		//first pass... cache should be cold.
		let page = await fn(...args);
		expect(page).toEqual(contents[dFile]);

		expect(fs.stat).toHaveBeenCalledWith(dFile);
		expect(fs.readFile).toHaveBeenCalledWith(dFile, 'utf8');

		fs.stat.mockClear();
		fs.readFile.mockClear();

		//second pass... cache should warm, and should hit.
		page = await fn(...args);
		expect(page).toEqual(contents[dFile]);

		expect(fs.stat).toHaveBeenCalledWith(dFile);
		expect(fs.readFile).not.toHaveBeenCalled();

		fs.stat.mockClear();
		fs.readFile.mockClear();

		//third pass cache should be invalidated by mod time... and produce a cache miss.
		jest.spyOn(fs, 'stat').mockImplementation(async f => ({
			mtime: new Date('2018-04-02T16:55:42.000Z'),
		}));
		page = await fn(...args);
		expect(page).toEqual(contents[dFile]);

		expect(fs.stat).toHaveBeenCalledWith(dFile);
		expect(fs.readFile).toHaveBeenCalledWith(dFile, 'utf8');
	});

	test('getTemplate (multiple templates)', async () => {
		const fs = require('fs').promises;
		const fn = require('../utils').getTemplate;

		const gen = x =>
			Array.from({ length: x })
				.map((_, i) => ({
					[path.resolve(`test${i}/page.html`)]: `file${i} contents`,
				}))
				.reduce((a, b) => ({ ...a, ...b }), {});

		const contents = {
			...gen(4),
		};

		expect(contents).not.toEqual({});

		jest.spyOn(fs, 'stat').mockImplementation(async f => ({
			mtime: new Date('2018-04-02T16:35:42.000Z'),
		}));
		jest.spyOn(fs, 'readFile').mockImplementation(async f => contents[f]);

		for (let file of Object.keys(contents)) {
			expect(await fn(path.dirname(file))).toEqual(contents[file]);
		}
	});
});
