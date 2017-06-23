const {ServiceStash} = require('nti-lib-interfaces');

const Logger = require('../logger');

const logger = Logger.get('SessionManager');


module.exports = exports = class SessionManager {
	constructor (server, sessionSetup) {
		if (!server) {
			throw new Error('No server interface!');
		}
		this.server = server;
		this.config = server.config;
		this.sessionSetup = sessionSetup;
	}


	getUser (context) {

		return this.getServiceDocument(context)
			.then(doc => {
				let w = doc.getUserWorkspace();
				if (w) {
					return w.Title;
				}
				return Promise.reject('No user workspace');
			});

	}


	getServiceDocument (context) {
		const {server} = this;
		return server.ping(context)	// server.getServiceDocument() pings as well...
									// if we didn't need the logon.logout url, we could omit this step here.
			.then(pong => server.getServiceDocument(context)
				//This seems dirty and out of place...
				.then(service => (
					service.setLogoutURL(pong.getLink('logon.logout')),
					service
				)));
	}


	setupIntitalData (context) {
		let url = context.originalUrl || context.url;
		logger.debug('SESSION [PRE-FETCHING DATA] %s %s (User: %s)', context.method, url, context.username);
		return this.server.getServiceDocument(context)
			.then(service => (
				context[ServiceStash] = service,
				this.sessionSetup && this.sessionSetup(service)
			));
	}


	middleware (basepath, req, res, next) {
		const start = Date.now();
		const url = req.originalUrl;
		const scope = url.substr(0, basepath.length) === basepath ? url.substr(basepath.length) : url;

		req.responseHeaders = req.responseHeaders || {};

		req.setMaxListeners(1000);
		req.socket.setKeepAlive(true, 1000);
		req.on('close', ()=> {
			req.dead = true;
			req.emit('aborted');
			next('aborted');
		});


		logger.debug('SESSION [BEGIN] %s %s', req.method, url);

		function finish () {
			if (req.dead) {
				return;
			}

			try {
				res.set(req.responseHeaders);
			} catch (e) {
				logger.warn('Could not set headers because: %s (headers: %o)', e.message, req.responseHeaders);
			}

			logger.debug('SESSION [END] %s %s (User: %s, %dms)',
				req.method, url, req.username, Date.now() - start);

			next();
		}

		return this.getUser(req)
			.then(user => req.username = user)
			.then(()=> logger.debug('SESSION [VALID] %s %s', req.method, url))
			.then(()=> !req.dead && this.setupIntitalData(req))
			.then(finish)
			.catch(this.maybeRedircect(basepath, scope, start, req, res, next))
			.catch(er => {
				logger.error('SESSION [ERROR] %s %s (%s, %dms)',
					req.method, url, er, Date.now() - start);

				next(er);
			});
	}


	maybeRedircect (basepath, scope, start, req, res, next) {
		const url = req.originalUrl;

		return reason => {
			if (req.dead) {return;}

			if ((reason || {}).hasOwnProperty('statusCode')) {
				reason = reason.statusCode;
			}

			if (reason instanceof Error) {
				return next(reason);
			}

			const returnTo = (
				//Only set the return url if the url is NOT the basepath
				(req.originalUrl !== basepath) ? '?return=' + encodeURIComponent(req.originalUrl) : ''
			);

			if (reason && reason.isLoginAction) {
				if(scope.startsWith(reason.route)) {
					return next();
				}

				logger.debug('SESSION [LOGIN ACTION REQUIRED] %s %s REDIRECT %s%s (User: %s, %dms)',
					req.method, url, basepath, reason.route, req.username, Date.now() - start);

				return res.redirect(`${basepath}${reason.route}${returnTo}`);
			}

			if (!/^(api|login)/.test(scope)) {
				logger.debug('SESSION [INVALID] %s %s REDIRECT %slogin/ (User: annonymous, %dms)',
					req.method, url, basepath, Date.now() - start);

				return res.redirect(`${basepath}login/${returnTo}`);
			}


			return Promise.reject(reason);
		};
	}


	anonymousMiddleware (basepath, context, res, next) {
		next();
	}

};
