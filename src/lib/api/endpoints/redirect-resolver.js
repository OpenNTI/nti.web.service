'use strict';

const resolve = u => fetch(u, {redirect: 'manual'});

function continueResolve (r, p) {
	const loc = r.headers.get('location');
	// console.log('\n\tHeader: %s\n\tPrev: %s\n\n', loc, p);

	if ((!r.ok && !loc) || (r.ok && !loc)) {
		return Promise.reject(r);
	}

	return resolve(loc)
		.then(x => continueResolve(x, loc))
		.catch(x => loc || Promise.reject(x));
}


exports.default = function register (api, config, server) {

	api.get(/^\/resolve-redirect/, (req, res) => {
		const {url} = req.query;

		res.set('User-Agent', 'Node + ' + req.get('User-Agent'));
		res.type('json');

		function fail (r) {
			const message = JSON.stringify({
				status: r.status,
				message: `${r.status} ${r.statusText}`
			});
			res.status(r.status || 400)
				.send(message)
				.end();
		}

		function sendResolved (u) {
			const message = JSON.stringify({location: u});
			res.status(200).send(message).end();
		}


		if (!url) {
			return fail({status: 422, statusText: 'url query required'});
		}

		resolve(url)
			.then(continueResolve)
			.then(sendResolved)
			.catch(fail);
	});
};
