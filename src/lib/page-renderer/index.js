/*eslint strict: 0*/
'use strict';

const {URL: {join: urlJoin}} = require('@nti/lib-commons');

const {
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

const shouldPrefix = (val, base) => isRootPath(val)
							&& !val.startsWith(base)
							&& !isSiteAssets(val)
							&& !isVendoredAssets(val)
							&& !isFavicon(val);

const attributesToFix = /(manifest|src|href)="(.*?)"/igm;
const fixAttributes = (base, original, attr, val) => `${attr}="${shouldPrefix(val, base) ? urlJoin(base, val) : val}"`;

const configValues = /<(!\[CDATA)?\[cfg:([^\]]*)\]\]?>/igm;
const fillInValues = (cfg, orginal, _, prop) => cfg[prop] === null ? '' : (cfg[prop] || `MissingConfigValue[${prop}]`);


function getRenderer (assets, renderContent, devmode) {

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

		// There are non-enumerable properties on config, and we need them passed to renderContent, so create a new cfg
		// with the original config as the prototype, and assign these new values to the wrapper object. (this is to
		// avoid mutating the config.
		const cfg = Object.assign(Object.create(config || {}), {
			html,
			url
		});

		return template
			.replace(configValues, fillInValues.bind(null, cfg))
			.replace(attributesToFix, fixAttributes.bind(null, basePath))
			.replace(/<!--html:server-values-->/i, await renderContent(cfg, markError));
	};
}
