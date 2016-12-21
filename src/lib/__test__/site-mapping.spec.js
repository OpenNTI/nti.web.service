'use strict';
const mock = require('mock-require');
const sinon = require('sinon');

const siteMap = {
	site1Alias1: 'site1',
	site1Alias2: 'site1Alias1',
	badAlias: 'someNonExistingKey',
	aliasBadCycle: 'aliasBadCycle2',
	aliasBadCycle1: 'aliasBadCycle2',
	aliasBadCycle2: 'aliasBadCycle1',
	site1: {
		title: 'This is Sparta!',
		name: 'sparta'
	}
};

describe('lib/site-mapping', () => {
	let logger, sandbox;

	beforeEach(() => {
		sandbox = sinon.sandbox.create();
		logger = {
			debug: sandbox.stub(),
			error: sandbox.stub(),
			info: sandbox.stub(),
			warn: sandbox.stub(),
		};

		mock('../logger', logger);
	});

	afterEach(() => {
		sandbox.restore();
		mock.stopAll();
	});

	it ('exports a function', () => {
		const fn = mock.reRequire('../site-mapping');

		fn.should.be.a('function');
		fn.length.should.be.equal(2);
	});

	it ('returns defaults', () => {
		const fn = mock.reRequire('../site-mapping');

		fn(siteMap, 'bla').should.be.ok
			.and.to.have.property('name', 'default');

		fn(siteMap, 'badAlias').should.be.ok
			.and.to.have.property('name', 'default');

		fn(siteMap).should.be.ok
			.and.to.have.property('name', 'default');

		fn().should.be.ok
			.and.to.have.property('name', 'default');

		logger.warn.should.have.been.calledThrice
			.and.have.been.calledWith('No site-mapping entry found for %s.', 'bla')
			.and.have.been.calledWith('No site-mapping entry found for %s.', 'badAlias')
			.and.have.been.calledWith('No site-mapping entry found for %s.', undefined);
	});

	it ('returns named entry', () => {
		const fn = mock.reRequire('../site-mapping');

		fn(siteMap, 'site1').should.be.equal(siteMap.site1);
	});

	it ('returns aliased entry', () => {
		const fn = mock.reRequire('../site-mapping');

		fn(siteMap, 'site1Alias1').should.be.equal(siteMap.site1);
		fn(siteMap, 'site1Alias2').should.be.equal(siteMap.site1);
	});

	it ('returns default for cycled alias', () => {
		const fn = mock.reRequire('../site-mapping');

		fn(siteMap, 'aliasBadCycle').should.be.ok
			.and.to.have.property('name', 'default');

		logger.warn.should.have.been.called
			.and.have.been.calledWith('Cycle in alias: %s -x-> %s <=')
			.and.have.been.calledWith('No site-mapping entry found for %s.', 'aliasBadCycle');
	});
});
