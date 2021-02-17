/*eslint-env jest*/
'use strict';
jest.mock('fs');

const stub = (a, b, c) => jest.spyOn(a, b).mockImplementation(c || (() => {}));

describe('lib/html-templates', () => {
	beforeEach(() => {
		jest.resetModules();
		const logger = require('../logger');
		stub(logger, 'get', () => logger);
		stub(logger, 'attachToExpress');
		stub(logger, 'debug');
		stub(logger, 'error');
		stub(logger, 'info');
		stub(logger, 'warn');
	});

	afterEach(() => {
		jest.resetModules();
	});

	test('Handles Error', () => {
		const fs = require('fs');
		const render = require('../html-templates');
		const err = new Error();
		const fn = jest.fn();

		stub(fs, 'readFile', (file, cb) => cb(err));

		render('file', { option: 'a' }, fn);

		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith(err);
	});

	test('Handles Template Options', () => {
		const fs = require('fs');
		const render = require('../html-templates');
		const fn = jest.fn();

		stub(fs, 'readFile', (file, cb) =>
			cb(
				null,
				`
		<title><![CDATA[cfg:siteTitle]]></title>
		<meh><![CDATA[cfg:missingMeh]]></meh>
		<meta http-equiv="foo" content="<[cfg:foo]>"/>
		<meta http-equiv="bar" content="<[cfg:missing]>"/>
		<script type="text/javascript">
		document.getElementById("content").innerHTML += '<div class="mobile">Try our <a href="/mobile/">mobile site</a></div>';

		if(document.referrer && history.replaceState){
			history.replaceState({},null,document.referrer);
		}

		if (typeof URL === 'function') {
			console.log('UNSUPPORTED ERROR: ', (new URL(location.href)).searchParams.get('error'));
		}
		</script>
		`
			)
		);

		render(
			'file',
			{
				siteTitle: 'foobar',
				foo: 'baz',
			},
			fn
		);

		expect(fn).toHaveBeenCalledWith(
			null,
			`
		<title>foobar</title>
		<meh>MissingConfigValue[missingMeh]</meh>
		<meta http-equiv="foo" content="baz"/>
		<meta http-equiv="bar" content="MissingConfigValue[missing]"/>
		<script type="text/javascript">
		document.getElementById("content").innerHTML += '<div class="mobile">Try our <a href="/mobile/">mobile site</a></div>';

		if(document.referrer && history.replaceState){
			history.replaceState({},null,document.referrer);
		}

		if (typeof URL === 'function') {
			console.log('UNSUPPORTED ERROR: ', (new URL(location.href)).searchParams.get('error'));
		}
		</script>
		`
		);
	});
});
