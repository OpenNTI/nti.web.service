/*globals expect*/
/*eslint-env mocha*/
'use strict';
const mock = require('mock-require');
const sinon = require('sinon');

describe('lib/master-utils', () => {
	let sandbox;

	beforeEach(() => {
		sandbox = sinon.sandbox.create();
		mock('cluster', {workers: []});
	});

	afterEach(() => {
		sandbox.restore();
		mock.stopAll();
	});

	it ('getConfig/setConfig work as expected', () => {
		const cfg = {test:'abc'};
		const copy = Object.assign({}, cfg);
		const {getConfig, setConfig} = mock.reRequire('../master-utils');
		//starts out unset
		expect(getConfig()).to.be.undefined;

		//safe on no input
		expect(() => setConfig()).to.not.throw();
		//safe on null input
		expect(() => setConfig(null)).to.not.throw();
		//safe on object
		expect(() => setConfig(cfg)).to.not.throw();
		//returns the thing given

		getConfig().should.be.equal(cfg);

		//does not modify thing? is this important?
		getConfig().should.be.deep.equal(copy);
	});


	it ('isValidWorkerCount() only accepts finite positive integers', () => {
		const {isValidWorkerCount} = mock.reRequire('../master-utils');

		isValidWorkerCount().should.be.false;
		isValidWorkerCount(null).should.be.false;
		isValidWorkerCount(NaN).should.be.false;
		isValidWorkerCount(Infinity).should.be.false;
		isValidWorkerCount(-Infinity).should.be.false;
		isValidWorkerCount(-12).should.be.false;
		isValidWorkerCount(-0.21).should.be.false;
		isValidWorkerCount(0).should.be.false;
		isValidWorkerCount(0.21).should.be.false;
		isValidWorkerCount(10.21).should.be.false;
		isValidWorkerCount('abc').should.be.false;
		isValidWorkerCount('901').should.be.false;

		isValidWorkerCount(1).should.be.true;
		isValidWorkerCount(100).should.be.true;
		isValidWorkerCount(1000).should.be.true;

	});

	it ('getConfiguredWorkerCount() returns the value of `workers` as an integer, if valid, otherwise 1, ignores argument', () => {
		const {setConfig, getConfiguredWorkerCount} = mock.reRequire('../master-utils');

		const goodValues = [{workers: 2}, {workers: '2'}, {workers: '10'}, {workers: 10}, {workers: 1}, {workers: 300}];
		for (let v of goodValues) {
			const c = parseInt(v.workers, 10);
			setConfig(v);
			getConfiguredWorkerCount().should.be.equal(c);
			//ingnores argument
			getConfiguredWorkerCount(54).should.be.equal(c);
		}

		const badValues = [void 0, null, {}, {workers: ''}, {workers: 'abc'}, {workers: 0}, {workers: '-9'}];
		for (let v of badValues) {
			setConfig(v);
			getConfiguredWorkerCount().should.be.equal(1);
			//ingnores argument
			getConfiguredWorkerCount(54).should.be.equal(1);
		}
	});

	it ('setConfiguredWorkerCount()', () => {
		const {getConfig, getConfiguredWorkerCount, setConfiguredWorkerCount} = mock.reRequire('../master-utils');
		// starts out unset
		expect(getConfig()).to.be.undefined;
		// base values
		getConfiguredWorkerCount().should.be.equal(1);

		// set to a valid 2
		expect(() => setConfiguredWorkerCount(2)).to.not.throw();
		const config = getConfig();

		// config was undefined, it should now be defined.
		config.should.not.be.undefined;
		// with a value for property workers.
		config.should.have.a.property('workers', 2);
		// getConfiguredWorkerCount should now return 2
		getConfiguredWorkerCount().should.be.equal(2);

		// now we're starting with a non-nully config...so we're updating workers.
		// set to a valid '2' (string)
		expect(() => setConfiguredWorkerCount('2')).to.not.throw();
		config.should.be.equal(getConfig()); //they should remain the same (eg: "===") object
		config.should.have.a.property('workers', '2');
		getConfiguredWorkerCount().should.be.equal(2);

		// anther update...to the config.
		// set to an invalid string
		expect(() => setConfiguredWorkerCount('foobar')).to.not.throw();
		config.should.be.equal(getConfig()); //they should remain the same (eg: "===") object
		config.should.have.a.property('workers', 'foobar');
		getConfiguredWorkerCount().should.be.equal(1);
	});

	it ('getActiveWorkers() is safe', () => {
		mock('cluster', {});
		const {getActiveWorkers} = mock.reRequire('../master-utils');

		//safe (the workers property is not defined)
		expect(() => getActiveWorkers()).not.to.throw();

		getActiveWorkers().should.be.an('Array');

		//the return value should always be new
		getActiveWorkers().should.not.equal(getActiveWorkers());

	});

	it ('getActiveWorkers() returns active workers', () => {
		mock('cluster', {workers: [
			{isDead: () => true},
			{isDead: () => false},
			{isDead: () => true},
			{}, // <= unexpected value
		]});
		const {getActiveWorkers} = mock.reRequire('../master-utils');

		//safe (note the empty object in the workers list)
		expect(() => getActiveWorkers()).not.to.throw();

		const active = getActiveWorkers();
		active.length.should.equal(1);
	});

});
