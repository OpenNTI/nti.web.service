'use strict';
/* istanbul ignore next */
(() => {//iife for istanbul ignore next
	//add polyfills and shims
	// require('core-js');
	require('regenerator-runtime/runtime');
	global.atob = require('atob');
	global.btoa = require('btoa');
	global.AbortController = global.AbortController || require('abort-controller');
	global.fetch = global.fetch || require('node-fetch');
})();
