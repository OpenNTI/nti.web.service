'use strict';
Object.assign(exports, {
	callThresholdMet,
	getErrorMessage,
	getStackOrMessage,
});


function getErrorMessage (e) {
	return e.message || e;
}


function getStackOrMessage (e) {
	return e.stack || getErrorMessage(e);
}



/**
 * Utility for determining if the function has been called too often.
 *
 * @param  {Function} fn                  The function to track
 * @param  {Number}   threshold           Number of calls to limit
 * @param  {Number}   [period=1000]       The timeframe in milliseconds to limit calls too
 * @param  {String}   [key='callCounter'] A property name to store our metadata on the function with
 * @return {Boolean}                      Returns whether this call is above or below the threshold.
 */
function callThresholdMet (fn, threshold, period = 1000, key = 'callCounter') {
	//store meta data on the function...
	const stats = fn[key] = (fn[key] || {count: 0});

	//increment call count.
	stats.count++;

	//clear previous timeout
	clearTimeout(stats.callThresholdTimeout);
	//start a new timeout (that will delete the meta data after the period)
	stats.callThresholdTimeout = setTimeout(() => delete fn[key], period);

	//return the inequality of the count vs the threshold
	return stats.count > threshold;
}
