'use strict';
const {default: HealthCheck} = require('./health-check');
const {default: UserAgreement} = require('./user-agreement');

const {default: UGDContextData} = require('./ugd/context-data');

const HANDLERS = [
	HealthCheck,
	UserAgreement,
	UGDContextData
];

module.exports = function registerEndPoints (api, config, dataserver) {

	for (let handler of HANDLERS) {
		handler(api, config, dataserver);
	}

};
