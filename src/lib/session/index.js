'use strict';
const { SERVER_REF } = require('../constants');
const Logger = require('../logger');

const logger = Logger.get('SessionManager');

module.exports = exports = class SessionManager {
	constructor(sessionSetup) {
		this.sessionSetup = sessionSetup;
	}

	getUser(context) {
		return this.getServiceDocument(context).then(doc => {
			let w = doc.getUserWorkspace();
			if (w) {
				return w.Title;
			}
			return Promise.reject('No user workspace');
		});
	}

	async getServiceDocument(context) {
		const { [SERVER_REF]: server } = context;
		return await server.getServiceDocument(context);
	}

	async setupInitialData(context) {
		const { [SERVER_REF]: server } = context;
		const url = context.originalUrl || context.url;
		logger.debug(
			'SESSION [PRE-FETCHING DATA] %s %s (User: %s)',
			context.method,
			url,
			context.username
		);

		const service = await server.getServiceDocument(context);

		await this.sessionSetup?.(service);
	}

	middleware(basepath, req, res, next) {
		const start = Date.now();
		const url = req.originalUrl;
		const scope =
			url.substr(0, basepath.length) === basepath
				? url.substr(basepath.length)
				: url;
		req.responseHeaders = req.responseHeaders || {};

		const skip = () => next('aborted');

		const reaper = () => {
			req.dead = true;
			req.emit('aborted');
			skip();
		};

		const cleanReaper = () => void req.removeListener('close', reaper);

		if (res.headersSent) {
			logger.error(
				'Headers have already been sent. did next() get called after a redirect()/send()/end()? %s %s',
				req.method,
				url
			);
			next('aborted');
			return;
		}

		req.setMaxListeners(1000);
		req.socket.setKeepAlive(true, 1000);
		req.once('close', reaper);

		logger.debug('SESSION [BEGIN] %s %s', req.method, url);

		function finish() {
			if (req.dead) {
				return;
			}

			try {
				res.set(req.responseHeaders);
			} catch (e) {
				logger.warn(
					'Could not set headers because: %s (headers: %o)',
					e.message,
					req.responseHeaders
				);
			}

			logger.debug(
				'SESSION [END] %s %s (User: %s, %dms)',
				req.method,
				url,
				req.username,
				Date.now() - start
			);

			next();
		}

		req.username = '[anonymous user]';
		return this.getUser(req)
			.then(user => (req.username = user))
			.then(() => logger.debug('SESSION [VALID] %s %s', req.method, url))
			.then(() => !req.dead && this.setupInitialData(req))
			.then(finish)
			.catch(this.maybeRedirect(basepath, scope, start, req, res, next))
			.catch(er => {
				logger.error(
					'SESSION [ERROR] %s %s (%s, %dms)',
					req.method,
					url,
					er,
					Date.now() - start
				);
				try {
					next(er);
				} catch (e) {
					//
				}
			})
			.then(cleanReaper);
	}

	maybeRedirect(basepath, scope, start, req, res, next) {
		const url = req.originalUrl;

		function redirect(uri) {
			try {
				return res.redirect(uri);
			} catch (e) {
				next(e);
			}
		}

		return reason => {
			if (req.dead) {
				return;
			}

			logger.debug('Session Failure: %o', reason);

			if (
				Object.prototype.hasOwnProperty.call(reason || {}, 'statusCode')
			) {
				reason = reason.statusCode;
			}

			if (
				reason instanceof Error &&
				!reason.NoContinueLink &&
				!reason.NoContineLink && // handle old typo spelling
				!/No continue link/i.test(reason.message)
			) {
				return next(reason);
			}

			const returnTo =
				//Only set the return url if the url is NOT the basepath
				req.originalUrl !== basepath
					? '?return=' + encodeURIComponent(req.originalUrl)
					: '';

			if (reason && reason.isLoginAction) {
				if (scope.startsWith(reason.route)) {
					return next();
				}

				logger.debug(
					'SESSION [LOGIN ACTION REQUIRED] %s %s REDIRECT %s%s (User: %s, %dms)',
					req.method,
					url,
					basepath,
					reason.route,
					req.username,
					Date.now() - start
				);

				return redirect(`${basepath}${reason.route}${returnTo}`);
			}

			if (!/^(api|login)/.test(scope)) {
				logger.debug(
					'SESSION [INVALID] %s %s REDIRECT %slogin/ (User: anonymous, %dms)',
					req.method,
					url,
					basepath,
					Date.now() - start
				);

				return redirect(`${basepath}login/${returnTo}`);
			}

			return Promise.reject(reason);
		};
	}

	async anonymousMiddleware(basepath, context, res, next) {
		const { [SERVER_REF]: server } = context;
		if (server) {
			await server.ping(void 0, context).catch(() => {});
		}
		next();
	}
};
