'use strict';
/* istanbul ignore next */
(() => {//iife for istanbul ignore next
	//add polyfills and shims
	// require('core-js');
	require('regenerator-runtime/runtime');
	global.AbortController = global.AbortController || require('abort-controller');
	global.fetch = global.fetch || require('node-fetch');

	global.atob = x => Buffer.from(x, 'base64').toString('binary');
	global.btoa = x =>
		((x instanceof Buffer) ? x : Buffer.from(x.toString(), 'binary')).toString('base64');

})();
