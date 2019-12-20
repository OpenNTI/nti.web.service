'use strict';
const fs = require('fs');
const path = require('path');

const yargs = require('yargs');
const uuid = require('uuid/v4');
const {ServiceStash} = require('@nti/lib-interfaces');

const {SERVER_REF} = require('./constants');
const getApplication = require('./app-loader');
const logger = require('./logger');


const self = Object.assign(exports, {
	clientConfig,
	config,
	loadConfig,
	nodeConfigAsClientConfig,
	showFlags,
	loadBranding,
	getFaviconFromBranding
});

const promisify = fn => (...args) => new Promise((f,r) => fn(...args, (er, v) => er ? r(er) : f(v)));
const stat = promisify(fs.stat);
const read = promisify(fs.readFile);


const opt = yargs
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
		'dataserver': {
			desc: 'Override DataServer uri',
			default: '/dataserver2/'
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
	.help('help', 'Usage')
	.alias('help', '?')
	.usage('WebApp Instance')
	.argv;

async function readFile (uri, resolveOrderForRelativePaths = [process.cwd()]) {
	if (uri.protocol === 'file:') {
		uri = uri.toString().replace(/^file:\/\//i, '');

		logger.debug('Attempting to resolve & load file with path: %s', uri);

		for (let p of resolveOrderForRelativePaths) {
			try {
				if ((await stat(p)).isDirectory()) {
					p = path.resolve(p, uri);
				}
				logger.debug('Attempting file at: %s', p);
				return await read(p);
			} catch (e) {
				logger.debug('File not available at: %s\n\t%s', p, e.message);
			}
		}

		return Promise.reject('File Failed to load: ' + uri);
	}


	const response = await fetch(uri);
	if (!response.ok) {
		return Promise.reject(response.statusText);
	}

	return response.text();
}


async function loadConfig () {
	if (!opt.config) {
		return Promise.reject('No config file specified');
	}

	try {
		const uri = new URL(opt.config, 'file://');
		const text = await readFile(uri, [
			path.resolve(process.cwd()),
			path.resolve(__dirname),
			path.resolve(__dirname, '../../config/env.json.example')
		]);

		return self.config(JSON.parse(text));
	}
	catch(e) {
		logger.error(e);
		throw e;
	}

}


function showFlags (config) {

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
}


function config (env) {
	const base = 'development';

	const serverOverride = opt['dataserver'];

	if (opt.env && env[opt.env] == null) {
		logger.error('Environment specified does not exist in config: %s', opt.env);
		return Promise.reject({
			reason: 'Missing Environment key',
			ENV: opt.env,
			config: env
		});
	}

	const envFlat = { ...env[base], ...env[opt.env]};

	const c = {
		webpack: opt.webpack, ...envFlat, protocol: opt.protocol,
		address: opt.l || envFlat.address || '0.0.0.0',
		port: parseInt(opt.p || envFlat.port, 10) //ensure port is 'number'
	};

	if (!Array.isArray(c.apps) || c.apps.length === 0) {
		logger.error('No apps configured!');
		return Promise.reject({
			reason: 'No apps key in config.',
			ENV: opt.env,
			config: c
		});
	}

	if (typeof c.port !== 'number' || !isFinite(c.port)) {
		logger.error('Invalid port number!', c.port);
		return Promise.reject({
			reason: 'Bad Port',
			config: c
		});
	}

	c.apps = c.apps.sort((a, b) => (
		b = b.basepath,
		a = a.basepath,
		//should it compare path segment count instead of pure length?
		b.length - a.length
		|| ( //fallback to normal string compare sort when lengths are equal...
			(a < b)
				? -1
				: (b < a)
					? 1
					: 0
		)
	));


	for(let a of c.apps) {
		try {
			const pkg = getApplication(a.package + '/package.json');

			a.appId = a.appId || pkg.name || a.basepath;
			a.appName = a.appName || pkg.name;
			a.appVersion = a.appVersion || pkg.version;

		} catch (e) {
			logger.warn('Could not fill in package values for app %s, because: %s', a.package, e.message);
		}

		if (!a.appId) {
			a.appId = a.basepath || uuid();
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

	if (serverOverride) {
		c.server = new URL(serverOverride, c.server).toString();
	}

	return c;
}

async function loadBranding (context) {
	try {
		const serverRef = context[SERVER_REF];
		const siteBrand = await serverRef.get('SiteBrand', context);

		return siteBrand;
	} catch (e) {
		logger.warn(`Could not load SiteBrand: ${JSON.stringify(e.error || e)}\n\t-> Request Headers: ${JSON.stringify({...context.headers, cookie: void 0})}`);
		return null;
	}
}

function getFaviconFromBranding (branding) {
	const {assets} = branding || {};
	const {favicon} = assets || {};

	if (!favicon) { return '/favicon.ico'; }

	const {'Last Modified': lastMod, href} = favicon;

	return lastMod ? `${href}?v=${lastMod}` : href;
}


function serviceRef (service, cfg) {
	return Object.defineProperty(cfg, 'nodeService', {
		configurable: true,
		enumerable: false,
		...(service
			? { value: service }
			: {
				get () {
					return Promise.reject(new Error('No Service.'));
				}
			})
	});
}


async function clientConfig (baseConfig, username, appId, context) {
	//unsafe to send to client raw... lets reduce it to essentials
	const app = (baseConfig.apps || []).reduce((r, o) => r || o.appId === appId && o, null) || {};
	const {pong = {}, protocol = 'http', headers: {host: hostname = '-'} = {}} = context;
	const userId = ({AuthenticatedUserId: x}) => x || null;

	const publicHost = new URL(`${protocol}://${hostname}`);
	const server = new URL(baseConfig.server, publicHost);

	const cfg = {
		...baseConfig,
		...app,
		//hide internal hostnames... If we ever host server & web-app on different domains this will have to be removed.
		server: server.pathname,
		userId: userId(pong),
		siteName: pong.Site || 'default',
		siteTitle: 'nextthought',
		username,
		locale: getLocale(context)
	};

	logger.info('Generating config for %s (SiteID: %s)', context.hostname, pong.Site);

	const blacklist = [/webpack.*/i, 'port', 'protocol', 'address', 'apps', 'site-mappings', 'package', 'keys'];

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

	cfg.branding = await loadBranding(context);
	cfg.favicon = getFaviconFromBranding(cfg.branding);

	if (cfg.branding && cfg.branding['brand_name']) {
		cfg.siteTitle = cfg.branding['brand_name'];
	}

	return {
		config: serviceRef(context[ServiceStash], cfg),
		html:
			'\n<script type="text/javascript">\n' +
			'window.$AppConfig = ' + JSON.stringify(cfg) +
			'\n</script>\n'
	};
}


function nodeConfigAsClientConfig (cfg, appId, context) {
	const {pong = {}} = context;
	const app = (cfg.apps || []).reduce((r, o) => r || o.appId === appId && o, null) || {};
	return {
		html: '',
		config: serviceRef(context[ServiceStash], {
			...cfg,
			...app,
			locale: getLocale(context),
			username: context.username,
			siteName: pong.Site || 'default',
			siteTitle: '-',
		})
	};
}


function getLocale (context) {
	return context.language || 'en';
}
