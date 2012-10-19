var logger = require('./logger.js');
var Game = require('./game.js');

var kGameUpdateInterval = 30; //30 ms

GameManager = (function () {
	var interval = null,
		games = [],
		// used to get games by ID (this happens very frequently, so having a (basically) hash map is
		// more efficient than looping through an array to find a game by ID
		gameMap = {};
	
	function loop() {
		for (var i = 0, len = games.length; i < len; ++i) {
			try {
				games[i].update();
			} catch (e) {
				logger.log('GAMEMANAGER: uncaught exception in game '+games[i].id+': '+e);
			}
		}
	}
		
	function startUpdateLoop() {
		logger.log('GAMEMANAGER: loop starting');
		interval = setInterval(loop, kGameUpdateInterval);
	}
		
	function stopUpdateLoop() {
		logger.log('GAMEMANAGER: loop stopping');
		clearInterval(interval);
		interval = null;
	}
	
	function generateNewGameId() {
		var chars = '0123456789abcdefghiklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXTZ'.split(''),
			str = '';
		for (var i = 0; i < 5; i++) {
			str += chars[Math.floor(Math.random() * chars.length)];
		}
		return str;
	}

	return {
		getGameById: function (gid) {
			return gameMap[gid] || null;
		},
		
		getGameByPlayerId: function (pid) {
			for (var i = 0, len = games.length; i < len; ++i) {
				if (games[i].getPlayerById(pid) !== null)
					return games[i];
			}
			return null;
		},
		
		getPublicGames: function () {
			var pub = [];
			for (var i = 0, len = games.length; i < len; ++i) {
				if (games[i].public === true)
					pub.push(games[i]);
			}
			return pub;
		},
		
		// creates, registers, and returns a new game with a randomly generated id
		createGame: function (name, maxPlayers, public) {
			var game = new Game(generateNewGameId(), name, maxPlayers, public);
			games.push(game);
			gameMap[game.id] = game;
			
			logger.log('GAMEMANAGER: created game "'+game.id+'"');
			if (interval === null)
				startUpdateLoop();
			return game;
		},
		
		// removes the game with the specified id;
		removeGame: function (gid) {
			for (var i = 0, len = games.length; i < len; ++i) {
				if (games[i].id === gid) {
					logger.log('GAMEMANAGER: removed game "'+gid+'"');
					delete gameMap[gid];
					return games.splice(i, 1);
				}
			}
			
			logger.log('GAMEMANAGER: Game with id "'+gid+'" does not exist!');
			
			if (games.length === 0)
				stopUpdateLoop();
		},
		
		// returns a random game, or null if there are none
		getRandomGame: function () {
			if (games.length > 0) {
				return games[Math.floor(Math.random() * games.length)];
			}
			return null;
		}
	}
})();

module.exports = GameManager;
