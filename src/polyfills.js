'use strict';
/* istanbul ignore file */
require('regenerator-runtime');

const g = globalThis;
//add polyfills and shims
import('node-fetch').then(({ default: fetch }) => (g.fetch = fetch));
g.atob = x => Buffer.from(x, 'base64').toString('binary');
g.btoa = x =>
	(x instanceof Buffer ? x : Buffer.from(x.toString(), 'binary')).toString(
		'base64'
	);
