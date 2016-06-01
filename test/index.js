'use strict';
global.SERVER = true;

const glob = require( 'glob' );


//This is for coverage
glob.sync( `${__dirname}/../src/**/*.js` )
	.forEach(file => {
		if (!/src\/index.js/.test(file)) {
			require( file );
		}
	});
