/*eslint strict: 0*/
'use strict';
const url = require('url');

const logger = require('../logger');

const {resolveTemplateFile, getModules, getTemplate} = require('./utils');

Object.assign(exports, {
	getRenderer
});


const isRootPath = /^\/(?!\/).*/;
const basepathreplace = /(manifest|src|href)="(.*?)"/igm;
const configValues = /<\[cfg\:([^\]]*)\]>/igm;
const injectConfig = (cfg, orginal, prop) => cfg[prop] || 'MissingConfigValue';


function getRenderer (assets, renderContent) {
	const templateFile = resolveTemplateFile(assets);
	let warnedAboutChunks = false;

	function warnAboutChunks (e) {
		if (!warnedAboutChunks) {
			warnedAboutChunks = true;
			logger.warn('Could not resolve chunk names: %s', e.message || e);
		}
	}


	return (basePath, req, clientConfig) => {
		const ScriptFilenameMap = { index: 'js/index.js' };
		const u = url.parse(req.url);
		const manifest = u.query === 'cache' ? '<html manifest="/manifest.appcache"' : '<html';

		return Promise.all([
			getTemplate(templateFile),
			getModules(assets)
				.catch(warnAboutChunks)
		])
			.then(([template = 'Bad Template', modules]) => {
				if (modules != null) {
					Object.assign(ScriptFilenameMap, modules);
				}

				const cfg = Object.assign({}, clientConfig.config || {});

				const basePathFix = (original, attr, val) => {
					const part = `${attr}="`;

					if (!isRootPath.test(val) || val.startsWith(basePath)) {
						return `${part}${val}"`;
					}

					return `${part}${(basePath || '/')}${val.substr(1)}"`;
				};

				let rendererdContent = '';
				try {
					if (renderContent) {
						rendererdContent = renderContent(clientConfig);
					}
				} catch (e) {
					logger.error('Could not render content: %s', e.stack || e.message || e);
				}

				const html = rendererdContent + clientConfig.html;

				let out = template
						.replace(/<html/, manifest)
						.replace(configValues, injectConfig.bind(this, cfg))
						.replace(basepathreplace, basePathFix)
						.replace(/<!--html:server-values-->/i, html)
						.replace(/resources\/styles\.css/, 'resources/styles.css?rel=' + encodeURIComponent(ScriptFilenameMap.index));

				for (let script of Object.keys(ScriptFilenameMap)) {
					out = out.replace(new RegExp(`js\\/${script}\\.js`), ScriptFilenameMap[script]);
				}

				return out;
			});
	};
}
