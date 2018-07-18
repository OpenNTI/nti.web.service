'use strict';
const fs = require('fs');

const {send} = require('./utils');

Object.assign(exports, {
	askToRestartOnce,
	restart,
	restartOnModification
});

function askToRestartOnce () {
	const {__called} = askToRestartOnce;
	if (!__called) {
		askToRestartOnce.__called = true;
		restart();
	}
}

function restart () {
	send({cmd: 'WORKER_WANTS_TO_RESTART_THE_POOL'});
}

function restartOnModification (file) {
	fs.watch(file, {persistent: false}, () => exports.askToRestartOnce());
}
