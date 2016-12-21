'use strict';
require('../src/polyfills');

global.chai = require('chai');
global.should = global.chai.should();
global.expect = global.chai.expect;
global.AssertionError = global.chai.AssertionError;
global.chai.use(require('sinon-chai'));
global.swallow = (thrower) => {try { thrower(); } catch (e) {/**/}};

const glob = require( 'glob' );


//This is for coverage and tests
glob.sync( `${__dirname}/../src/**/*.js` )
	.forEach(file => {
		if (!/src\/index.js/.test(file)) {
			require( file );
		}
	});
