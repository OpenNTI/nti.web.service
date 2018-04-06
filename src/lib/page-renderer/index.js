/*eslint strict: 0*/
'use strict';

const {URL: {join: urlJoin}} = require('nti-commons');

const {
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

const shouldPrefix = val => isRootPath(val) && !isSiteAssets(val) && !isVendoredAssets(val) && !isFavicon(val);

const attributesToFix = /(manifest|src|href)="(.*?)"/igm;
const fixAttributes = (base, original, attr, val) => `${attr}="${shouldPrefix(val) ? urlJoin(base, val) : val}"`;

const configValues = /<\[cfg:([^\]]*)\]>/igm;
const fillInValues = (cfg, orginal, prop) => cfg[prop] || 'MissingConfigValue';


function getRenderer (assets, renderContent, devmode) {

	//TODO: Delete this after we update webpack4...
	async function applyWebpack3Compat (out) {
		const ScriptFilenameMap = { index: 'js/index.js', ...(await getModules(assets))};

		for (let script of Object.keys(ScriptFilenameMap)) {
			out = out.replace(new RegExp(`js\\/${script}\\.js`), ScriptFilenameMap[script]);
		}

		return out.replace(/resources\/styles\.css"/, `resources/styles.css?rel=${encodeURIComponent(ScriptFilenameMap.index)}"`);
	}


	if (!renderContent) {
		renderContent = ({html}) => html;
	}

	/**
	 * @method render
	 * @param  {string} basePath            The public root path this app is hosted at.
	 * @param  {Object} req                 The request object from express.
	 * @param  {Object} clientConfig        The clientConfig object.
	 * @param  {Function} [markError=NOOP]  An optional content rendering function. May return a string or a Promise
	 *                                      that fulfills with a string.
	 * @return {Promise<string>}            Fulfills with the rendered page as a string
	 */
	return async function render (basePath, {url} = {}, {html, config} = {}, markError = NOOP) {
		const template = (await getTemplate(assets, devmode)) || 'Bad Template';

		const cfg = {
			html,
			url,
			...(config || {})
		};

		return applyWebpack3Compat( template
			.replace(configValues, fillInValues.bind(null, cfg))
			.replace(attributesToFix, fixAttributes.bind(null, basePath))
			.replace(/<!--html:server-values-->/i, await renderContent(cfg, markError))
		);
	};
}
