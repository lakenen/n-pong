exports.log = function () {
	var args = Array.prototype.slice.call(arguments);
	args.unshift('\033[36m'+(new Date())+' -\033[39m');
	console.log.apply(console, args);
}