'use strict';
const g = globalThis;
import('node-fetch').then(({ default: fetch }) => (g.fetch = fetch));

require('regenerator-runtime');

/* istanbul ignore next */
(() => {
	//iife for istanbul ignore next
	//add polyfills and shims

	g.atob = x => Buffer.from(x, 'base64').toString('binary');
	g.btoa = x =>
		(x instanceof Buffer
			? x
			: Buffer.from(x.toString(), 'binary')
		).toString('base64');
})();
