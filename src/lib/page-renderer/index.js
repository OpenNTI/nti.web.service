/*eslint strict: 0*/
'use strict';

const { URL: { join: urlJoin } } = require('@nti/lib-commons');

const {
	getTemplate,
} = require('./utils');

Object.assign(exports, {
	getRenderer
});

const Identity = x => x;
const NOOP = () => { };
const ESCAPES = {
	raw: x => x,
	html: x => x
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;'),

	string: x => x
		.replace(/\\/g, '\\\\')
		.replace(/\n/g, '\\n')
		.replace(/\r/g, '\\r')
		.replace(/'/g, '\\\'')
		.replace(/"/g, '\\"')
		.replace(/`/g, '\\`'),
};

const isRootPath = RegExp.prototype.test.bind(/^\/(?!\/).*/);
const isSiteAssets = RegExp.prototype.test.bind(/^\/site-assets/);
const isVendorAssets = RegExp.prototype.test.bind(/^\/vendor/);
const isFavicon = RegExp.prototype.test.bind(/^\/favicon\.ico/);

const shouldPrefix = (val, base) => isRootPath(val)
	&& !val.startsWith(base)
	&& !isSiteAssets(val)
	&& !isVendorAssets(val)
	&& !isFavicon(val);

const attributesToFix = /(manifest|src|href)="(.*?)"/igm;
const fixAttributes = (base, original, attr, val) => `${attr}="${shouldPrefix(val, base) ? urlJoin(base, val) : val}"`;

const configValues = /<(!\[CDATA)?\[cfg:([^\]]*)\]\]?>/igm;
const fillInValues = (cfg, original, _, prop) => {
	const [
		propertyName,
		filter = 'html'
	] = prop.split('|');
	const value = cfg[propertyName] === null ? '' : (cfg[propertyName] || `MissingConfigValue[${propertyName}]`);

	const filterFn = ESCAPES[filter] || Identity;

	return filterFn(value);
};


function getRenderer(assets, renderContent, devmode) {

	if (!renderContent) {
		renderContent = ({ html }) => html;
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
	return async function render(basePath, { url, config: { templateInjections } = {} } = {}, { html, config } = {}, markError = NOOP) {
		const template = (await getTemplate(assets, templateInjections, devmode)) || 'Bad Template';

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
