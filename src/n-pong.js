var http = require('http'),
	util = require('util'),
    url = require('url'),
	path = require('path'),
	fs = require('fs'),
	logger = require('./logger.js'),
	_ = require('underscore'),
	GameManager = require('./gamemanager.js'),
	io = require('socket.io');

var argv = require('optimist').argv;

// assuming io is the Socket.IO server object
io.configure(function () {
	io.set("transports", ["xhr-polling"]);
	io.set("polling duration", 10);
});

var mimeTypes = {
    "html": "text/html",
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "png": "image/png",
    "js": "text/javascript",
    "css": "text/css"};

var serverDefaults = {
	port: argv.p || process.env.PORT || 8000,
	maxGames: 1
};

var Server = module.exports = function (options) {
	this.options = _.extend(serverDefaults, options);

	_.bindAll(this);

	this.http = http.createServer(function(req, res){
		var uri = url.parse(req.url).pathname;
		if (uri === '/') uri = 'index.html';
		var filename = path.join('public', uri);
		path.exists(filename, function(exists) {
			if(!exists) {
				console.log("does not exist: " + filename);
				res.writeHead(200, {'Content-Type': 'text/plain'});
				res.write('404 Not Found\n');
				res.end();
				return;
			}
			var mimeType = mimeTypes[path.extname(filename).split(".")[1]];
			res.writeHead(200, {'Content-Type':mimeType});

			var fileStream = fs.createReadStream(filename);
			fileStream.pipe(res);
		}); //end path.exists
	});

	this.http.listen(this.options.port);

	this.io = io.listen(this.http);

	this.io.configure(function () {
		this.disable('log');
	});

	this.io.on('connection', this._handleSocketConnection);

	logger.log("SERVER: server listening on port "+this.options.port);
};

Server.prototype._handleSocketConnection = function (socket) {
	var self = this, game;

	socket.on('create', function (data) {
		// the client wants to create a game
		// first make sure this client isn't in a different game... that's not OK
		if (game || GameManager.getGameByPlayerId(socket.id) !== null) {
			logger.log('SERVER: client attempted to create multiple games');
			return;
		}
		// create a new (paused/waiting-for-players) game and add a new player for this client
		game = GameManager.createGame(data.name);
		game.addPlayer(socket);
	});

	socket.on('update', function (data) {
		// the player is updating us with their current position
		if (game !== null) {
			// tell the game to update the player's position
			game.updatePlayerPosition(socket.id, data.x, data.y);
		} else {
			logger.log('SERVER: client updating for a non-existent game!');
			// @TODO tell the client they are not in a valid game
		}
	});

	socket.on('join', function (data) {
		// the player is asking to join a game
		// first make sure this client isn't in a different game... that's not OK
		if (game || GameManager.getGameByPlayerId(socket.id) !== null) {
			console.log('SERVER: client attempted to join multiple games');
			return;
		}
		// if gameId is specified, try that, else try to get a random game..
		game = GameManager.getGameById(data.id) || GameManager.getRandomGame();
		if (game !== null) {
			// create a new player on this game
			if (game.addPlayer(socket) !== null)
				logger.log('SERVER: client joined game '+game.id);
			else {
				// TODO send the player a message saying the game is full!
			}
		} else {
			logger.log('SERVER: client tried to join, but the game was not found');
			// @TODO tell the client there are no available gamaes
		}
	});

	socket.on('info', function (data, fn) {
		// the client is requesting info
		var publicGames = GameManager.getPublicGames();
		// respond with a list of public games they can join
		var response = {
			r: 'i',
			pg: []
		};
		for (var i = 0, len = publicGames.length; i < len; ++i) {
			response.pg.push({
				id: publicGames[i].id,
				numPlayers: publicGames[i].players.length,
				maxPlayers: publicGames[i].maxPlayers
			});
		}
		fn(response);
	});

	socket.on('leave', function () {
		game = game || GameManager.getGameByPlayerId(socket.id);
		if (game !== null)
			game.removePlayer(socket.id);
	});

	socket.on('disconnect', function () {
		game = game || GameManager.getGameByPlayerId(socket.id);
		if (game !== null)
			game.removePlayer(socket.id);
	});
};

// allow normal node loading if appropriate
if (!module.parent) {
	var server = new Server();
}
