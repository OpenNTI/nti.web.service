/*
This file was copied from the mobile app, and is not meant to be tested, but
to provide plugin code to test the harness. Code in this file is meant to
expose potential problems for the service so we can produce errors for tests.
 */
const needsAttention = route => Promise.reject({isLoginAction: true, route});

module.exports = function sessionSetup (service) {
	return service.getAppUser()

		.then(user => {
			if (user.acceptTermsOfService) {
				return needsAttention('onboarding/tos');
			}
			return user;
		})

		.then(() => Promise.all([
			service
		]));
};
