const Logger = require('../logger');
// const {
// 	// Catalog,
// 	Library,
// 	// Notifications
// } = require('nti-lib-interfaces');

const logger = Logger.get('SessionManager:Setup');

const needsAttention = route => Promise.reject({isLoginAction: true, route});

exports.sessionSetup = function sessionSetup (service) {
	return service.getAppUser()

		.then(user => {
			if (user.acceptTermsOfService) {
				logger.info('User needs to accept terms of service.');
				return needsAttention('onboarding/tos');
			}
			return user;
		})

		.then(user => {
			if(user.hasLink('RegistrationSurvey')) {
				logger.info('User needs to submit registration survey.');
				return needsAttention('onboarding/survey');
			}
		})

		//TODO: Add More Login Actions HERE.

		.then(() => Promise.all([
			service
			// Library.load(service, 'Main'),
			// Catalog.load(service),
			// Notifications.load(service)
		]));
}
