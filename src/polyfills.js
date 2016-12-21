/* istanbul ignore next */
(() => {//iife for istanbul ignore next
	//add polyfills and shims
	require('core-js');
	global.fetch = global.fetch || require('node-fetch');
})();
