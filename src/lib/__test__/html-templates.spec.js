/*eslint-env jest*/
'use strict';
jest.mock('fs');

const stub = (a, b, c) => jest.spyOn(a, b).mockImplementation(c || (() => {}));

describe('lib/html-templates', () => {

	beforeEach(() => {
		jest.resetModules();
	});


	afterEach(() => {
		jest.resetModules();
	});


	test ('Handles Error', () => {
		const fs = require('fs');
		const render = require('../html-templates');
		const err = new Error();
		const fn = jest.fn();

		stub(fs, 'readFile', (file, cb) => cb(err));

		render('file', {option: 'a'}, fn);

		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith(err);
	});

	test ('Handles Template Options', () => {
		const fs = require('fs');
		const render = require('../html-templates');
		const fn = jest.fn();

		stub(fs, 'readFile', (file, cb) => cb(null, '{} {option} {option2}'));

		render('file', {option: 'a'}, fn);

		expect(fn).toHaveBeenCalledWith(null, '{} a MissingTemplateValue: {option2}');
	});



});
