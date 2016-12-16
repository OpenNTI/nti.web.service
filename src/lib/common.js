'use strict';
const fs = require('fs');
const url = require('url');
const path = require('path');
const uuid = require('node-uuid');

const dsi = require('nti-lib-interfaces');
const SiteName = dsi.SiteName;
const ServiceStash = dsi.ServiceStash;

const getSiteFrom = require('./site-mapping');
const logger = require('./logger');


const getSite = (env, x) => getSiteFrom((env || {})['site-mappings'] || {}, x);


//Use native node require() for optimist since it defines a 'default' property on the exports.
const opt = require('yargs')
		.usage('WebApp Instance')
			.options({
				'l': {
					alias: 'listen',
					desc: 'Force server to liston on address'
				},
				'p': {
					alias: 'port',
					desc: 'Liston on port'
				},
				'protocol': {
					demand: true,
					default: 'proxy',
					desc: 'Protocol to use (proxy or http)'
				},
				'dataserver-host': {
					desc: 'Override DataServer host (this trumps the config)'
				},
				'dataserver-port': {
					desc: 'Override DataServer port (this trumps the config)'
				},
				'webpack': {
					desc: 'Prefix with "no-" to force the dev-server off.',
					type: 'boolean',
					default: true
				},
				'config': {
					demand: true,
					default: '../config/env.json',
					desc: 'URI/path to config file (http/https/file/path)'
				},
				'env': {
					default: process.env.NODE_ENV,
					desc: 'Specify env config key'
				}
			})
			.help('help', 'Usage').alias('help', '?')
			.argv;


exports.loadConfig = function loadConfig () {
	if (!opt.config) {
		return Promise.reject('No config file specified');
	}

	return new Promise((pass, fail)=> {

		let uri = url.parse(opt.config);
		if (uri.protocol == null || uri.protocol === 'file:') {
			uri = opt.config.replace(/^file:\/\//i, '');

			const resolveOrder = [
				path.resolve(process.cwd(), uri),
				path.resolve(__dirname, uri),
				path.resolve(__dirname, '../../config/env.json.example')
			]

			logger.debug('Attempting to resolve & load config with path: %s', uri);
			for (let p of resolveOrder) {
				try {
					logger.debug('Attempting Config at: %s', p);
					return pass(exports.config(JSON.parse(fs.readFileSync(p))));
				} catch (e) {
					logger.debug('Config not available at: %s\n\t%s', p, e.message);
				}
			}

			return fail('Config Failed to load');
		}

		fetch(opt.config)
		 	.then(response => response.ok ? response.json() : Promise.reject(response.statusText))
			.then(body => {
				pass(exports.config(body));
			})
			.catch(e => {
				logger.error(e);
				fail(e)
			});

	});
};


exports.showFlags = function showFlags (config) {

	if (!config.flags) {
		logger.info('No flags configured.');
		return;
	}

	for (let flag of Object.keys(config.flags)) {
		let value = config.flags[flag];

		if (typeof value === 'object') {
			for (let siteFlag of Object.keys(value)) {
				logger.info('Resolved Flag: (%s) %s = %s', flag, siteFlag, value[siteFlag]);
			}
			continue;
		}

		logger.info('Resolved Flag: (Global) %s = %s', flag, value);
	}
};


exports.config = function config (env) {
	const base = 'development';

	const serverHost = opt['dataserver-host'];
	const serverPort = opt['dataserver-port'];

	if (opt.env && env[opt.env] == null) {
		logger.error('Environment specified does not exist in config: %s', opt.env);
		return Promise.reject({
			reason: 'Missing Environment key',
			ENV: opt.env,
			config: env
		});
	}

	const envFlat = Object.assign({}, env[base], env[opt.env]);

	const c = Object.assign(
		{webpack: opt.webpack}, envFlat, {
			protocol: opt.protocol,
			address: opt.l || envFlat.address || '0.0.0.0',
			port: opt.p || envFlat.port
		});

	if (!Array.isArray(c.apps)) {
		logger.error('No apps configured!');
		return Promise.reject({
			reason: 'No apps key in config.',
			ENV: opt.env,
			config: c
		});
	}

	for(let a of c.apps) {
		try {
			const pkg = require.main.require(a.package + '/package.json');

			a.appId = a.appId || a.basepath || pkg.name;
			a.appName = a.appName || pkg.name;
			a.appVersion = a.appVersion || pkg.version;

		} catch (e) {
			logger.warn('Could not fill in package values for app %s, because: %s', a.package, e.message);
		}

		if (!a.appId) {
			a.appId = a.basepath || uuid.v4();
		}
	}

	if (!config.printed) {
		config.printed = true;
		if (env[opt.env] != null) {
			logger.info(`In ${opt.env} mode`);
		} else {
			logger.warn('In default "development" mode. Consider --env "production" or setting NODE_ENV="production"');
		}
	}

	if (serverHost || serverPort) {
		let server = url.parse(c.server);
		server.host = null;
		if (serverHost) {
			server.hostname = serverHost;
		}
		if (serverPort) {
			server.port = serverPort;
		}
		c.server = server.format();
	}

	return c;
};


function dontUseMe () {
	throw new Error(
		'Use the Service to make your requests. ' +
		'The interface is not meant to be used directly ' +
		'anymore. (So we can centrally manage request contexts.)');
}


function noServiceAndThereShouldBe () {
	throw new Error('No Service.');
}


exports.clientConfig = function clientConfig (baseConfig, username, appId, context) {
	//unsafe to send to client raw... lets reduce it to essentials
	const app = (baseConfig.apps || []).reduce((r, o) => r || o.appId === appId && o, null) || {};
	const site = getSite(baseConfig, context[SiteName]);
	const cfg = Object.assign({}, baseConfig, app, {
		siteName: site.name,
		siteTitle: site.title,
		username
	});

	const blacklist = [/webpack.*/i, 'port', 'protocol', 'address', 'apps'];

	for (let blocked of blacklist) {
		if (typeof blocked === 'string') {
			delete cfg[blocked];
		} else {
			for(let prop of Object.keys(cfg)) {
				if (blocked.test(prop)) {
					delete cfg[prop];
				}
			}
		}
	}


	return {
		//used only on server
		config: Object.assign({}, cfg, {
			nodeInterface: dontUseMe,
			nodeService: context[ServiceStash] || noServiceAndThereShouldBe
		}),
		html:
			'\n<script type="text/javascript">\n' +
			'window.$AppConfig = ' + JSON.stringify(cfg) +
			'\n</script>\n'
	};
};


exports.nodeConfigAsClientConfig = function nodeConfigAsClientConfig (cfg, appId, context) {
	const app = (cfg.apps || []).reduce((r, o) => r || o.appId === appId && o, null) || {};
	return {
		html: '',
		config: Object.assign({}, cfg, app, {
			username: context.username,
			siteName: getSite(cfg, context[SiteName]),
			nodeInterface: dontUseMe,
			nodeService: context[ServiceStash] || noServiceAndThereShouldBe
		})
	};
};
