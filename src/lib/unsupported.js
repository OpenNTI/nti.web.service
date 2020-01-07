'use strict';
module.exports = function unsupported (config) {
	return (req, res, next) =>
		res.render('unsupported', config);
};
