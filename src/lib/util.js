Object.assign(exports, {
	getStackOrMessage,
	getErrorMessage
});

function getStackOrMessage (e) {
	return e.stack || e.message || e;
}

function getErrorMessage (e) {
	return e.message || e;
}
