/*eslint-env jest*/
'use strict';

describe('Bootstraps', () => {

	beforeEach(() => {
		jest.resetModules();
		const logger = require('../lib/logger');
		const noop = () => {};
		jest.spyOn(logger, 'debug').mockImplementation(noop);
		jest.spyOn(logger, 'error').mockImplementation(noop);
		jest.spyOn(logger, 'info').mockImplementation(noop);
		jest.spyOn(logger, 'warn').mockImplementation(noop);

		jest.mock('../polyfills', () => {});
	});

	it ('isMaster: true, master bootstraps. not worker.', () => {
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

	it ('isMaster: false, worker bootstraps. not master.', () => {
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
