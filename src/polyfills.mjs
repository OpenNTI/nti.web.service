import fetch from 'node-fetch';
import 'regenerator-runtime';

/* istanbul ignore next */
(() => {
	//iife for istanbul ignore next
	//add polyfills and shims
	const g = globalThis;

	if (!g.fetch) {
		g.fetch = fetch;
	}

	g.atob = x => Buffer.from(x, 'base64').toString('binary');
	g.btoa = x =>
		(x instanceof Buffer
			? x
			: Buffer.from(x.toString(), 'binary')
		).toString('base64');
})();
