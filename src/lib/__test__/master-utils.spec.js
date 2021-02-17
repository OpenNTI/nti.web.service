/*eslint-env jest*/
'use strict';

const stub = (a, b, c) => jest.spyOn(a, b).mockImplementation(c || (() => {}));

describe('lib/master-utils', () => {
	let logger;

	beforeEach(() => {
		jest.resetModules();
		logger = require('../logger');

		stub(logger, 'get', () => logger);
		stub(logger, 'attachToExpress');
		stub(logger, 'debug');
		stub(logger, 'error');
		stub(logger, 'info');
		stub(logger, 'warn');

		jest.doMock('cluster', () => ({ workers: [] }));
	});

	afterEach(() => {
		jest.dontMock('cluster');
		jest.resetModules();
	});

	test('getConfig/setConfig work as expected', () => {
		const cfg = { test: 'abc' };
		const copy = { ...cfg };
		const { getConfig, setConfig } = require('../master-utils');
		//starts out unset
		expect(getConfig()).toEqual(undefined);

		//safe on no input
		expect(() => setConfig()).not.toThrow();
		//safe on null input
		expect(() => setConfig(null)).not.toThrow();
		//safe on object
		expect(() => setConfig(cfg)).not.toThrow();
		//returns the thing given

		expect(getConfig()).toBe(cfg);

		//does not modify thing? is this important?
		expect(getConfig()).toEqual(copy);
	});

	test('isValidWorkerCount() only accepts finite positive integers', () => {
		const { isValidWorkerCount } = require('../master-utils');

		expect(isValidWorkerCount()).toBe(false);
		expect(isValidWorkerCount(null)).toBe(false);
		expect(isValidWorkerCount(NaN)).toBe(false);
		expect(isValidWorkerCount(Infinity)).toBe(false);
		expect(isValidWorkerCount(-Infinity)).toBe(false);
		expect(isValidWorkerCount(-12)).toBe(false);
		expect(isValidWorkerCount(-0.21)).toBe(false);
		expect(isValidWorkerCount(0)).toBe(false);
		expect(isValidWorkerCount(0.21)).toBe(false);
		expect(isValidWorkerCount(10.21)).toBe(false);
		expect(isValidWorkerCount('abc')).toBe(false);
		expect(isValidWorkerCount('901')).toBe(false);

		expect(isValidWorkerCount(1)).toBe(true);
		expect(isValidWorkerCount(100)).toBe(true);
		expect(isValidWorkerCount(1000)).toBe(true);
	});

	test('getConfiguredWorkerCount() returns the value of `workers` as an integer, if valid, otherwise 1, ignores argument', () => {
		const {
			setConfig,
			getConfiguredWorkerCount,
		} = require('../master-utils');

		const goodValues = [
			{ workers: 2 },
			{ workers: '2' },
			{ workers: '10' },
			{ workers: 10 },
			{ workers: 1 },
			{ workers: 300 },
		];
		for (let v of goodValues) {
			const c = parseInt(v.workers, 10);
			setConfig(v);
			expect(getConfiguredWorkerCount()).toEqual(c);
			//ingnores argument
			expect(getConfiguredWorkerCount(54)).toEqual(c);
		}

		const badValues = [
			void 0,
			null,
			{},
			{ workers: '' },
			{ workers: 'abc' },
			{ workers: 0 },
			{ workers: '-9' },
		];
		for (let v of badValues) {
			setConfig(v);
			expect(getConfiguredWorkerCount()).toEqual(1);
			//ingnores argument
			expect(getConfiguredWorkerCount(54)).toEqual(1);
		}
	});

	test('setConfiguredWorkerCount()', () => {
		const {
			getConfig,
			getConfiguredWorkerCount,
			setConfiguredWorkerCount,
		} = require('../master-utils');
		// starts out unset
		expect(getConfig()).toEqual(undefined);
		// base values
		expect(getConfiguredWorkerCount()).toEqual(1);

		// set to a valid 2
		expect(() => setConfiguredWorkerCount(2)).not.toThrow();
		const config = getConfig();

		// config was undefined, it should now be defined.
		expect(config).toBeDefined();
		// with a value for property workers.
		expect(config).toHaveProperty('workers', 2);
		// getConfiguredWorkerCount should now return 2
		expect(getConfiguredWorkerCount()).toEqual(2);

		// now we're starting with a non-nully config...so we're updating workers.
		// set to a valid '2' (string)
		expect(() => setConfiguredWorkerCount('2')).not.toThrow();
		expect(config).toEqual(getConfig()); //they should remain the same (eg: "===") object
		expect(config).toHaveProperty('workers', '2');
		expect(getConfiguredWorkerCount()).toEqual(2);

		// anther update...to the config.
		// set to an invalid string
		expect(() => setConfiguredWorkerCount('foobar')).not.toThrow();
		expect(config).toEqual(getConfig()); //they should remain the same (eg: "===") object
		expect(config).toHaveProperty('workers', 'foobar');
		expect(getConfiguredWorkerCount()).toEqual(1);
	});

	test('getActiveWorkers() is safe', () => {
		jest.doMock('cluster', () => ({}));
		const { getActiveWorkers } = require('../master-utils');

		//safe (the workers property is not defined)
		expect(() => getActiveWorkers()).not.toThrow();

		expect(getActiveWorkers()).toEqual(expect.any(Array));

		//the return value should always be new
		expect(getActiveWorkers()).not.toBe(getActiveWorkers());
	});

	test('getActiveWorkers() returns active workers', () => {
		jest.doMock('cluster', () => ({
			workers: [
				{ isDead: () => true },
				{ isDead: () => false },
				{ isDead: () => true },
				{}, // <= unexpected value
			],
		}));
		const { getActiveWorkers } = require('../master-utils');

		//safe (note the empty object in the workers list)
		expect(() => getActiveWorkers()).not.toThrow();

		const active = getActiveWorkers();
		expect(active.length).toEqual(1);
	});
});
