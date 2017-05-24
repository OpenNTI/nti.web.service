Object.assign(exports, {
	restart
});

function restart () {
	process.send({cmd: 'WORKER_WANTS_TO_RESTART_THE_POOL'});
}
