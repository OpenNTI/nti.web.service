/*eslint-env jest*/
'use strict';

const stub = (a, b, c) => jest.spyOn(a, b).mockImplementation(c || (() => {}));


describe('lib/restart', () => {

	beforeEach(() => {
		jest.resetModules();
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
		const send = process.send
			? (stub(process, 'send'), process.send)
			: (process.send = stubby);

		const {restart} = require('../restart');

		restart();

		if (send === stubby) {
			delete process.send;
		}

		expect(send).toHaveBeenCalledTimes(1);
		expect(send).toHaveBeenCalledWith({cmd: 'WORKER_WANTS_TO_RESTART_THE_POOL'});
	});

});
