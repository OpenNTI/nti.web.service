'use strict';
const HealthCheck = require('./health-check');
const UserAgreement = require('./user-agreement');

const UGDContextData = require('./ugd/context-data');

let HANDLERS = [
	HealthCheck,
	UserAgreement,
	UGDContextData
];

module.exports = function registerEndPoints (api, config, dataserver) {

	for (let handler of HANDLERS) {
		handler(api, config, dataserver);
	}

};
