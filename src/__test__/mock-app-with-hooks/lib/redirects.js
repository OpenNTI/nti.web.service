/*
This file was copied from the mobile app, and is not meant to be tested, but
to provide plugin code to test the harness. Code in this file is meant to
expose potential problems for the service so we can produce errors for tests.
 */

'use strict';
const path = require('path');

const SEGMENT_HANDLERS = {
	redeem: (catalogId, segments) =>
		path.join('catalog', 'redeem', catalogId, segments[1]),

	forcredit: catalogId =>
		// catalog/enroll/apply/NTI-CourseInfo-Summer2015_LSTD_1153_Block_C/
		path.join('catalog', 'enroll', 'apply', catalogId, '/'),

	[null]: catalogId => path.join('catalog', 'item', catalogId),
};

const HANDLERS = {
	handleObjectRedirects: /(\/id|ntiid)\//i,
	handleInvitationRedirects: /invitations\/accept/i,
	handleLibraryRedirects: /^library/i,
	//the path may not always start with /app/ but it will always be have one path segment in front.
	handleLibraryPathRedirects: /^\/[^/]+\/library/i,
};

exports = module.exports = {
	register(express, config) {
		this.basepath = config.basepath;

		express.use((req, res, next) => {
			// the query (q) is deprecated, but
			// if its present, it trumps the path (p)
			let redirectParam = req.query.q || req.query.p;
			if (!redirectParam) {
				return next();
			}

			for (let handlerName of Object.keys(HANDLERS)) {
				let test = HANDLERS[handlerName];
				if (redirectParam.match(test)) {
					return this[handlerName](redirectParam, res, next);
				}
			}

			return res.redirect(this.basepath);
		});
	},

	handleInvitationRedirects(query, res, next) {
		/*
		 *	from:
		 *	library/courses/available/invitations/accept/<token>
		 *
		 *	to:
		 *	<basepath>/catalog/code/<token>
		 */

		// [full match, token]
		let parts = query.match(/accept\/([^/]*)/);
		if (parts) {
			let url = path.join(this.basepath, 'catalog', 'code', parts[1]);
			res.redirect(url);
			return;
		}

		next();
	},

	handleLibraryPathRedirects(query, res, next) {
		/* From:
		 * /app/library/courses/available/NTI-CourseInfo-iLed_iLed_001/...
		 *
		 * To:
		 * <basepath>/catalog/item/NTI-CourseInfo-iLed_iLed_001/...
		 */

		let pattern = /library\/courses\/available\/(.*)/;
		let parts = query.match(pattern);
		if (parts) {
			let url = path.join(this.basepath, 'catalog', 'item', parts[1]);
			res.redirect(url);
			return;
		}

		next();
	},

	async handleLibraryRedirects(query, res, next) {
		let url = query;
		let catalog = /library\/availablecourses\/([^/]*)\/?(.*)/;

		/* From:
		 * ?q=library/availablecourses/IUB0YWc6bmV4dHRob3VnaHQuY29tLDIwMTEtMTA6TlRJLUNvdXJzZUluZm8tU3ByaW5nMjAxNV9MU1REXzExNTM/redeem/code
		 *
		 * To:
		 * <basepath>/catalog/item/NTI-CourseInfo-Spring2015_LSTD_1153/enrollment/store/gift/redeem/code
		 */

		// [full match, catalog item id (encoded), trailing path]
		let parts = url.match(catalog);
		if (parts) {
			let catalogId = await translateCatalogId(parts[1]);
			let trailingPath = translatePath(catalogId, parts[2]) || '';

			url = path.join(this.basepath, trailingPath);

			res.redirect(url);
			return;
		}

		next();
	},

	async handleObjectRedirects(query, res, next) {
		const { encodeForURI, decodeFromURI } = await import('@nti/lib-ntiids');
		/* From:
		 *	/app/id/unknown-OID-0x021cae18:5573657273:V0wWNR9EBJd
		 *	object/ntiid/tag:nextthought.com,2011-10:unknown-OID-0x021cae18:5573657273:V0wWNR9EBJd
		 *
		 * To:
		 * 	<basepath>/object/unknown-OID-0x021cae18:5573657273:V0wWNR9EBJd
		 */

		let object = /(?:(?:id|ntiid)\/)([^/]*)\/?(.*)/;
		let match = decodeURIComponent(query).match(object);

		if (match) {
			let [, ntiid] = match;

			let url = path.join(
				this.basepath,
				'object',
				encodeForURI(decodeFromURI(ntiid))
			);

			res.redirect(url);
			return;
		}

		next();
	},
};

function translatePath(catalogId, trailingPath) {
	let segments = (trailingPath || '').split('/');

	let handler = SEGMENT_HANDLERS[segments[0] || null];

	return handler.call(null, catalogId, segments);
}

async function translateCatalogId(input) {
	const { encodeForURI } = await import('@nti/lib-ntiids');
	let catalogId = input.replace(/-/g, '+').replace(/_/g, '/');

	catalogId = Buffer.from(catalogId, 'base64').toString('utf8');
	catalogId = catalogId.replace(/^!@/, ''); //strip off the WebApp's 'salt'
	catalogId = encodeForURI(catalogId);

	return catalogId;
}
