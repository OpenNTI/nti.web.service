'use strict';
const {default: HealthCheck} = require('./health-check');
const {default: UserAgreement} = require('./user-agreement');
const {default: UGDContextData} = require('./ugd/context-data');
const {default: VideoData} = require('./videos');

const HANDLERS = [
	HealthCheck,
	UserAgreement,
	UGDContextData,
	VideoData
];

module.exports = function registerEndPoints (api, config, routeFactory) {

	for (let handler of HANDLERS) {
		handler(api, config, routeFactory);
	}

};
