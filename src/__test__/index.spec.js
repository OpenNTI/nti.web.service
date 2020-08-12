/*eslint-env jest*/
'use strict';

const stub = (a, b, c) => jest.spyOn(a, b).mockImplementation(c || (() => {}));

describe('Bootstraps', () => {

	beforeEach(() => {
		jest.resetModules();
		jest.dontMock('cluster');
		const logger = require('../lib/logger');
		stub(logger, 'get', () => logger);
		stub(logger, 'debug');
		stub(logger, 'error');
		stub(logger, 'info');
		stub(logger, 'warn');

		jest.doMock('../polyfills');
	});

	afterEach(() => {
		jest.resetModules();
		jest.dontMock('cluster');
	});

	test ('isMaster: true, master bootstraps. not worker.', () => {
		const master = jest.fn();
		const worker = jest.fn();
		jest.doMock('cluster', () => ({isMaster: true}));
		jest.doMock('../master', () => ({start: master}));
		jest.doMock('../worker', () => ({start: worker}));

		const {run} = require('../index');
		run();

		expect(master).toHaveBeenCalledTimes(1);
		expect(master).toHaveBeenCalledWith();
		expect(worker).not.toHaveBeenCalled();
	});

	test ('isMaster: false, worker bootstraps. not master.', () => {
		const master = jest.fn();
		const worker = jest.fn();
		jest.doMock('cluster', () => ({isMaster: false}));
		jest.doMock('../master', () => ({start: master}));
		jest.doMock('../worker', () => ({start: worker}));

		const {run} = require('../index');
		run();

		expect(worker).toHaveBeenCalledTimes(1);
		expect(worker).toHaveBeenCalledWith();
		expect(master).not.toHaveBeenCalled();
	});

});
