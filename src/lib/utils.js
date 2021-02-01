'use strict';
Object.assign(exports, {
	callThresholdMet,
	getErrorMessage,
	getStackOrMessage,
	send
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
 * @param  {number}   threshold           Number of calls to limit
 * @param  {number}   [period=1000]       The time frame in milliseconds to limit calls too
 * @param  {string}   [key='callCounter'] A property name to store our metadata on the function with
 * @returns {boolean}                      Returns whether this call is above or below the threshold.
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



function send (msg) {
	process.send({
		topic: 'default',
		...msg
	});
}
