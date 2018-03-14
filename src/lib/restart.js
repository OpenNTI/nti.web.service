const fs = require('fs');


Object.assign(exports, {
	restart,
	restartOnModification
});

let askToRestartOnce = () => {
	restart();
	askToRestartOnce = () => {};
};


function restart () {
	process.send({cmd: 'WORKER_WANTS_TO_RESTART_THE_POOL'});
}


function restartOnModification (file) {
	fs.watch(file, {persistent: false}, () => askToRestartOnce());
}
