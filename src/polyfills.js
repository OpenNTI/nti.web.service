/* istanbul ignore next */
(() => {//iife for istanbul ignore next
	//add polyfills and shims
	require('core-js');
	require('regenerator-runtime/runtime');
	global.fetch = global.fetch || require('node-fetch');
})();
