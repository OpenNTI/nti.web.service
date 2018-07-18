/*eslint-env jest*/
'use strict';
jest.mock('fs');

const stub = (a, b, c) => jest.spyOn(a, b).mockImplementation(c || (() => {}));


describe('lib/restart', () => {

	beforeEach(() => {
		jest.resetModules();
		const logger = require('../logger');

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

	test ('exports a restart function', () => {
		const {restart: fn} = require('../restart');

		expect(fn).toEqual(expect.any(Function));
		expect(fn.length).toEqual(0);
	});

	test ('restart() sends WORKER_WANTS_TO_RESTART_THE_POOL', () => {
		const stubby = jest.fn();
		const send = (process.send = stubby);

		const {restart} = require('../restart');

		restart();

		if (send === stubby) {
			delete process.send;
		}

		expect(send).toHaveBeenCalledTimes(1);
		expect(send).toHaveBeenCalledWith({topic: 'default', cmd: 'WORKER_WANTS_TO_RESTART_THE_POOL'});
	});

	test ('askToRestartOnce() sends WORKER_WANTS_TO_RESTART_THE_POOL only once', () => {
		const stubby = jest.fn();
		const send = (process.send = stubby);

		const {askToRestartOnce} = require('../restart');

		askToRestartOnce();

		askToRestartOnce();

		if (send === stubby) {
			delete process.send;
		}

		expect(send).toHaveBeenCalledTimes(1);
		expect(send).toHaveBeenCalledWith({topic: 'default', cmd: 'WORKER_WANTS_TO_RESTART_THE_POOL'});
	});

	test ('restartOnModification() calls askToRestartOnce', () => {
		const fs = require('fs');
		const restart = require('../restart');
		stub(restart, 'askToRestartOnce');
		stub(fs, 'watch', (file, opts, cb) => cb());

		expect(() => restart.restartOnModification('foo')).not.toThrow();
		expect(restart.askToRestartOnce).toHaveBeenCalled();

		fs.watch.mockClear();

		expect(restart.restartOnModification('foo')).toBeFalsy();
		expect(fs.watch).toHaveBeenCalledTimes(1);
		expect(fs.watch).toHaveBeenCalledWith('foo', {persistent: false}, expect.any(Function));
	});

});
