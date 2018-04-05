/*eslint strict: 0*/
'use strict';
const url = require('url');

const {URL: {join: urlJoin}} = require('nti-commons');

const {
	resolveTemplateFile,
	getModules, //not needed in webpack4
	getTemplate,
} = require('./utils');

Object.assign(exports, {
	getRenderer
});

const NOOP = () => {};
const isRootPath = RegExp.prototype.test.bind(/^\/(?!\/).*/);
const isSiteAssets = RegExp.prototype.test.bind(/^\/site-assets/);
const isVendoredAssets = RegExp.prototype.test.bind(/^\/vendor/);
const isFavicon = RegExp.prototype.test.bind(/^\/favicon\.ico/);
const shouldPrefixBasePath = val => isRootPath(val) && !isSiteAssets(val) && !isVendoredAssets(val) && !isFavicon(val);

const basepathreplace = /(manifest|src|href)="(.*?)"/igm;
const configValues = /<\[cfg:([^\]]*)\]>/igm;
const injectConfig = (cfg, orginal, prop) => cfg[prop] || 'MissingConfigValue';

function getRenderer (assets, renderContent, devmode) {
	const templateFile = (devmode || {}).template || resolveTemplateFile(assets);

	return async (basePath, req, clientConfig, markError = NOOP) => {
		const u = url.parse(req.url);
		const manifest = u.query === 'cache' ? '<html manifest="/manifest.appcache"' : '<html';

		const template = (await getTemplate(templateFile)) || 'Bad Template';

		const cfg = Object.assign({url: req.url}, clientConfig.config || {});

		const basePathFix = (original, attr, val) =>
			attr + `="${
				shouldPrefixBasePath(val)
					? urlJoin(basePath, val)
					: val
			}"`;

		const rendererdContent = (!renderContent) ? '' : renderContent(cfg, markError);

		const html = rendererdContent + clientConfig.html;

		//not needed in webpack4:
		const ScriptFilenameMap = { index: 'js/index.js', ...(await getModules(assets))};

		let out = template
			.replace(/<html/, manifest)
			.replace(configValues, injectConfig.bind(this, cfg))
			.replace(basepathreplace, basePathFix)
			.replace(/<!--html:server-values-->/i, html)
			//not needed in webpack4:
			.replace(/resources\/styles\.css"/, `resources/styles.css?rel=${encodeURIComponent(ScriptFilenameMap.index)}"`);

		//not needed in webpack4:
		for (let script of Object.keys(ScriptFilenameMap)) {
			out = out.replace(new RegExp(`js\\/${script}\\.js`), ScriptFilenameMap[script]);
		}

		return out;
	};
}
