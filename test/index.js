'use strict';
global.SERVER = true;

const glob = require( 'glob' );


//This is for coverage
glob.sync( `${__dirname}/../lib/**/*.js` ).forEach(file => require( file ) );
