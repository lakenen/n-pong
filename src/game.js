var logger = require('./logger.js'),
	Animation = require('../lib/Animation.js').Transform,
	Vector = require('../lib/Vector.js');
	//_ = require('underscore');


// CONSTANTS
var kPlayerReorientationTime = 1.0; 
var kGoalAnimationTime       = 2.0; //2.0s
var kGameStartupTime         = 0.5; //0.5s
var kPlayerPaddleHitAnimationTime = 0.5; //s

var kGameMaxPlayers = 10;
var kPlayerIdleKickTime = 60000; // 60 sec

var kGameBoardDimension = 700; //700 pixels

var kBallMaxVelocity  = 100; //100 pixels / sec
var kBallAcceleration = 30; //40 pixels / sec^2

var kGameUpdateInterval = 30; //30 ms
var kBallMaxUpdateVelocity = kBallMaxVelocity / kGameUpdateInterval;
var kBallUpdateAcceleration = kBallAcceleration / kGameUpdateInterval;

var kBallRadius      = 5; //4 pixels
var kBallResetPauseDuration = 1000; //ms
var kPaddleLength     = 50; //20 pixels
var kPaddleThickness    = 10; //4 pixels
var kPaddleMaxBounce = 15 * (Math.PI / 180); //15 degrees (converted to radians)    
var kPaddleGameBoardPadding = 20; // the distance the paddle should sit away from the game board edge
var kPlayerPositionValidationEpsilon = 1;

Math.clamp = function(a, b, c) {
	if(c < a) return a;
	if(c > b) return b;
	return c;
};
Math.inRange = function(a, b, c) {
	if (a < b)
		return (c >= a && c <= b);
	return (c >= b && c <= a);
};

// Paddle constructor
// @param Vector pos		The initial position of the paddle
// @param Number t			The initial orientation of the paddle (radians)
function Paddle(pos, t) {
	this.position = pos || new Vector();
	this.theta = t || 0;
}

Paddle.prototype.toJSON = function () {
	return {
		x: this.position.x,
		y: this.position.y,
		t: this.theta
	};
};

// Ball constructor
// @param Vector pos		The initial position of the ball
// @param Vector vel		The initial velocity of the ball
function Ball(pos, vel) {
	this.position = pos || new Vector();
	this.velocity = vel || new Vector();
	this.paused = true;
}

Ball.prototype.pause = function () {
	clearTimeout(this.pauseTID);
	this.pauseTID = setTimeout(function (self) {
		self.paused = false;
	}, kBallResetPauseDuration, this);
};

// only need to send the position of the ball
Ball.prototype.toJSON = function () {
	return this.position.toJSON();
};


// Player constructor
// @param Connection conn
function Player(conn) {
	this.conn = conn;
	this.id = this.conn.id;
	this.paddle = new Paddle();
	this.edge = null;
	// number of times they hit a ball
	this.hits = 0;
	// number of times a ball hit their goal
	this.misses = 0;
	this.lastSeen = (new Date()).getTime();
}

Player.prototype.toJSON = function () {
	var p = this.paddle.toJSON();
	p.s = this.hits * 100 - this.misses * 200;
	return p;
};

Player.prototype.send = function (type, data) {
	try {
		this.conn.emit(type, data);
	} catch (e) {
		logger.log('PLAYER: could not send ('+e+')');
	}
};




// Game constructor
// @param String id
function Game(id, name, maxPlayers, public) {
	this.id = id;
	this.players = [];
	this.playerMap = {};
	this.board = [];
	// start with one ball
	this.balls = [new Ball()];
	this.resetBall(this.balls[0]);
	this.boardAnimations = [];
	this.gameAnimations = [];
	this.public = public;
	this.name = name || 'Pong!';
	this.maxPlayers = maxPlayers || kGameMaxPlayers;
}

Game.prototype = {
	getPlayerById: function (pid) {
		return this.playerMap[pid] || null;
	},
	
	getPlayerByEdge: function (edge) {
		for (var i in this.players) {
			if (this.players[i].edge === edge)
				return this.players[i];
		}
		return null;
	},
	
	
	// Add and return a player to the game
	addPlayer: function (conn) {
		if (this.players.length === this.maxPlayers) {
			logger.log("GAME: the game is full; can't add player!");
			return null;
		}
		
		// first, make sure they aren't in the game already somehow...
		if (this.getPlayerById(conn.id) !== null) {
			logger.log('GAME: the specified player "'+pid+'" is already in this game ('+this.id+')!');
			return null;
		}
		// if this is not the first player in the game,
		// use the last board/player position as this starting position
		var player = new Player(conn);
		var numPlayers = this.players.length;
		switch (numPlayers) {
			case 0:
				// 1st player... 
				player.paddle = new Paddle(new Vector(kGameBoardDimension/2 - 1, kGameBoardDimension/2 - 1), Math.PI);
				player.edge = 0;
				break;
			case 1:
				// 2nd player.. enter 2 player game mode
				player.paddle = new Paddle(new Vector(kGameBoardDimension/2 - 1, kGameBoardDimension/2 - 1), Math.PI);			
				// all points in the center, so it grows out
				this.board = [
					new Vector(kGameBoardDimension/2 - 1, kGameBoardDimension/2 - 1),
					new Vector(kGameBoardDimension/2 - 1, kGameBoardDimension/2 - 1),
					new Vector(kGameBoardDimension/2 - 1, kGameBoardDimension/2 - 1),
					new Vector(kGameBoardDimension/2 - 1, kGameBoardDimension/2 - 1)
				];
				this.players[0].edge = 0;
				player.edge = 2;
				break;
			case 2:
				// 3rd player... fix the board, since 2 player broke it
				this.board.pop();
				this.board.shift();
				// fix other players' edges
				this.players[0].edge = 0;
				this.players[1].edge = 1;
				// don't break... fall through to the next case
			default:
				this.board.push(new Vector(this.board[this.players.length-1]));
				player.paddle = new Paddle(
					new Vector(this.board[this.players.length-1]),
					this.players[this.players.length-1].paddle.theta
				);
				player.edge = numPlayers;
				if (numPlayers%2==0) this.balls.push(new Ball());
				break;
		}

		this.players.push(player);
		this.playerMap[player.id] = player;
		
		// send the new gameId back to the client
		player.send('info',
			{
				gameId: this.id,
				canvasWidth: kGameBoardDimension,
				canvasHeight: kGameBoardDimension,
				paddleThickness: kPaddleThickness,
				paddleLength: kPaddleLength,
				paddleGameBoardPadding: kPaddleGameBoardPadding,
				ballRadius: kBallRadius
			});
		// need to modify the board for the new player count
		this.updateBoard();
		
		return player;
	},
	
	removePlayer: function (pid) {
		var player = null;
		// remove them from the players array
		for (var i in this.players) {
			if (this.players[i].id === pid) {
				player = this.players.splice(i, 1);
				try {
					player.conn.close();
				} catch (e) {
					// do nothing.. it was probably already closed
				}
				// remove the board position
				if (this.players.length == 2) {
					this.board.splice(i, 0, new Vector(this.board[i]));
					this.players[0].edge = 0;
					this.players[1].edge = 2;
				} else {
					this.board.splice(i, 1);
					for (var j = i; j < this.players.length; j++)
						 this.players[j].edge--;
				}
				break;
			}
		}
		if (player === null)
			logger.log('GAME: Player with id "'+pid+'" does not exist in this game ('+this.id+')!');
		if (this.players.length % 2==0)this.balls.pop();
		// delete them from teh player map
		delete this.playerMap[pid];
		
		// remove this game if there are no players left
		if (this.players.length === 0) {
			GameManager.removeGame(this.id);
		} else {
			// need to modify the board for the new player count
			this.updateBoard();
		}
		
		return this;
	},
	
	// figures out new board positions and animates them with Animations,
	// based on number of players in the game
	updateBoard: function () {
		this.paused = true;
		// cancel any animations on this game
		clearTimeout(this.unpauseTimeout);
		this.cancelBoardAnimations();
	
		var numPlayers = this.players.length;
		// a reference to this so we can use it in onFinish functions
		var game = this;
		switch (numPlayers) {
			case 0:
				// the game is empty... that's not good! KILL IT
				GameManager.removeGame(this.id);
				return;
			case 1:
				// only one player, so make them wait...
				
				return;
			case 2:
				// special case for 2 players
				this.boardAnimations.push(new Animation(this, {
					duration: kPlayerReorientationTime,
					to: {
						board: [
							{ x: kGameBoardDimension-1, y: kGameBoardDimension/4 - 1 },
							{ x: kGameBoardDimension-1, y: kGameBoardDimension/4 + kGameBoardDimension/2 - 1 },
							{ x: 0, y: kGameBoardDimension/4 + kGameBoardDimension/2 - 1 },
							{ x: 0, y: kGameBoardDimension/4 - 1 }
						],
						players: [
							{
								paddle: {
									position: {
										x: kGameBoardDimension-1 - kPaddleGameBoardPadding,
										y: kGameBoardDimension/2 - 1
									},
									theta: 3*Math.PI/2
								}
							},
							{
								paddle: {
									position: {
										x: kPaddleGameBoardPadding,
										y: kGameBoardDimension/2 - 1
									},
									theta: Math.PI/2
								}
							}
						]
					},
					onFinish: function () {
						game.paused = false;
						game.boardChanged = false;
						
						for (var b in game.balls) {
							game.resetBall(game.balls[b]);
						}
					}
				}));
				this.boardChanged = true;
				break;
			default:
				// n-gon
				var thetaStep = 2 * Math.PI / numPlayers;
				// tmp state to animate to
				var newGameState = { 
					board: this.board.slice(),
					players: this.board.slice()
				};
				for (var i = 0; i < numPlayers; ++i) {
					var theta = thetaStep * i;
					var thetaPlus1 = thetaStep * (i + 1);
					var A = new Vector(Math.cos(theta) * (kGameBoardDimension-1), Math.sin(theta) * (kGameBoardDimension-1));
					var B = new Vector(Math.cos(thetaPlus1) * (kGameBoardDimension-1), Math.sin(thetaPlus1) * (kGameBoardDimension-1));
					
					//logger.log(A, B);
					// normalize to actual board size
					A.add(new Vector(kGameBoardDimension-1,kGameBoardDimension-1)).scale(1/2);
					B.add(new Vector(kGameBoardDimension-1,kGameBoardDimension-1)).scale(1/2);
					
					// move the paddle to the correct location
					var newPaddle = this.calculatePaddle(A, B);
					
					// add animations to shift the board corners and paddle orientations
					newGameState.board[i] = A;
					newGameState.players[i].paddle = newPaddle;
				}
				this.boardAnimations.push(new Animation(this, {
					duration : kPlayerReorientationTime,
					to: newGameState,
					onFinish: function () {
						game.paused = false;
						game.boardChanged = false;
						
						for (var b in game.balls) {
							game.resetBall(game.balls[b]);
						}
					}
				}));
				this.boardChanged = true;
				break;
		}
	},
	
	// given the edge points, calculate where to put the paddle
	calculatePaddle: function (A, B, P) {
		// N is the normal vector to the board edge
		var N = Vector.subtract(A, B).cross(Vector.k);
		
		// if no P was passed, make it midpoint by default
		if (!P) {
			P = Vector.average(A, B);
		}
		
		return new Paddle(
			Vector.add(P, N.unit().scale(kPaddleGameBoardPadding)),
			Vector.subtract(B, A).orientationZ()
		);
	},
	
	updateBalls: function () {
		if (!this.paused) {
	
			for (var i in this.balls) {
				var ball = this.balls[i];
				if (ball.paused) continue;
				
				// if ball is not at its max speed, increase magnitude of its velocity slightly
				if (ball.velocity.magnitude() < kBallMaxUpdateVelocity)
					ball.velocity.addToMagnitude(kBallUpdateAcceleration);
				
				// calculate new ball position based on its velocity
				ball.position.add(ball.velocity);
				
				var numPlayers = this.players.length,
					boardSize = this.board.length;
				
				// detect collisions!
				for (var i = 0; i < numPlayers; ++i) {
					var player = this.players[i];
					
					// translate the ball's position/velocity to align with the paddle
					var ballTransPos = Vector.subtract(ball.position, player.paddle.position).rotateZ(-player.paddle.theta);
					var ballTransVel = Vector.rotateZ(ball.velocity, -player.paddle.theta);
					
					// TODO: fix bug where ball goes into the side of a paddle
					
					if ( Math.abs(ballTransPos.x) < (kPaddleLength / 2 + kBallRadius) && 
						Math.abs(ballTransPos.y) < (kPaddleThickness / 2 + kBallRadius))
					{
						
						
						logger.log("GAME: ball hit player "+i+"'s paddle");
						player.hits++;
						
						//Get the new velocity (modding based on hit location)
						var newVel = new Vector(ballTransVel);
						newVel.y = Math.abs(newVel.y);
						newVel.rotateZ(player.paddle.theta + Math.round(Math.random())*(-1)*Math.random()*kPaddleMaxBounce);
						//newVel.rotateZ(-paddleBounce);
						ball.velocity = newVel;
						
						
						var paddleBounce = 2*ballTransPos.x / kPaddleLength * -kPaddleMaxBounce;
						var tmpTheta = player.paddle.theta;
						new Animation(player.paddle, {
							duration: 0.25*kPlayerPaddleHitAnimationTime,
							to: { theta: player.paddle.theta + paddleBounce },
							onFinish: (function () {	
								var p = player;
								return function () {
									new Animation(p.paddle, {
										duration: 0.25*kPlayerPaddleHitAnimationTime,
										to: { theta: tmpTheta },
									});
								};
							})()
						});
					}
				}
				
				// check for wall hits (goals... or bounces in 2 player)
				for (var i = 0; i < boardSize; i++) {
					// for each edge (b1, b2)
					var b1 = new Vector(this.board[i]),
						b2 = new Vector(this.board[(i+1)%boardSize]),
						// get the edge (b1-b2)
						E = Vector.subtract(b1, b2),
						// get the midpoint by taking avg of b1, b2
						M = Vector.average(b1, b2),
						// get E's orientation edgeTheta about Z axis with Math.atan2(E.y, E.x)
						edgeTheta = Math.atan2(E.y, E.x),
						ballTransPos = Vector.subtract(ball.position, M).rotateZ(-edgeTheta);
						
					// check if the ball is outside the edge
					if (ballTransPos.y >= 0) {
						if (Math.abs(ballTransPos.x) < E.magnitude()/2) {
							// ball hit this edge! GOOOAAALLLL
							var newVel = Vector.rotateZ(ball.velocity, -edgeTheta);
							newVel.y *= -1;
							ball.velocity = newVel.rotateZ(edgeTheta + Math.round(Math.random())*(-1)*Math.random()*kPaddleMaxBounce);
							logger.log('GAME: ball hit edge '+i);
							
							player = this.getPlayerByEdge(i)
							if (player) {
								logger.log('GAME: GOOOOAAAAAL!');
								player.misses++;
								this.resetBall(ball);
							}
						}
					}
				}
			}
		}
	},
	
	// this function updates everything about the game and sends the
	// updated state to all the players. this will be called in an interval
	// that updates every kGameUpdateInterval ms
	update: function () {
		// remove idle players
		//this.kickIdlePlayers();
		
		var numPlayers = this.players.length;
		var numBalls = this.balls.length;
		
		
		// update ball positions, check for collisions/goals
		this.updateBalls();
	
		var gameState = {
			pp: this.players,
			b: this.balls
		};
		
		// only send the board if it changed
		if (this.boardChanged) {
			gameState.p = this.board;
		}
		
		//logger.log('GAME: updating!');
		//logger.log(gameState);
		// send updates to players
		for (var i = 0; i < numPlayers; ++i) {
			gameState.me = i;
			gameState.e = this.players[i].edge;
			this.players[i].send('update', gameState);
		}
	},
	
	kickIdlePlayers: function () {
		// don't kick the player if they are the only one in the game
		if (this.players.length < 2) {
			this.players[0].lastSeen = (new Date()).getTime();
			return;
		}
		var now = (new Date()).getTime(),
			kicked = [];
		for (var i = 0, len = this.players.length; i < len; ++i) {
			if (now - this.players[i].lastSeen > kPlayerIdleKickTime) {
				var player = this.players[i];
				
				logger.log("GAME: kicking player "+player.id+" due to inactivity");
				// tell the player they were kicked
				player.send('kick');
				kicked.push(player.id);
			}
		}
		for (var i = 0, len = kicked.length; i < len; ++i) {
			this.removePlayer(kicked[i]);
		}
	},
	
	resetBall: function (ball) {
		// puts the ball in the center of the board with initial velocity in a random direction
		ball.position = Vector.average(this.board);
		ball.velocity = new Vector(kBallUpdateAcceleration, kBallUpdateAcceleration);
		if (this.board.length === 4) {
			// TODO: clamp this so it doesn't start the ball pointed at an edge
			ball.velocity.rotateZ(Math.random()*2*Math.PI);
		} else {
			ball.velocity.rotateZ(Math.random()*2*Math.PI);
		}
		ball.pause();
	},
	
	updatePlayerPosition: function (pid, x, y) {
		var player = this.getPlayerById(pid);
		if (player !== null) {
			//console.log(x, y);
			player.lastSeen = (new Date()).getTime();
			
			// make sure the position is valid !!
			var b1 = new Vector(this.board[player.edge]),
				b2 = new Vector(this.board[(player.edge+1)%this.board.length]);

			try {
				// if the edge doesn't exist, the player has to be on the point
				if (b1.eq(b2) && !b1.eq(new Vector(x, y)))
					throw 'b1 == b2 and b1 != point';
				
				// check if the point is on the edge
				
				// if it's not a vertical line...
				if (b1.x - b2.x > kPlayerPositionValidationEpsilon) {
					var m = (b1.y - b2.y) / (b1.x - b2.x);
					var b = b1.y - m * b1.x;
					if (Math.abs(y - (m * x + b)) > kPlayerPositionValidationEpsilon)
						throw 'not on line '+y+'!='+m+'*'+x+'+'+b;
					else if (!Math.inRange(b1.x, b2.x, x))
						throw 'on line, but not within bounds';
				} else {
					if (!Math.inRange(b1.y, b2.y, y))
						throw 'not within bounds on vertical line';
				}
			} catch (e) {
				logger.log('Invalid player position on edge '+player.edge+': '+e);
				return;
			}
			// get the player's position on the edge (basically ratio of the edge length)
			player.paddle = this.calculatePaddle(b1, b2, new Vector(x, y));
		}
	},
	
	cancelBoardAnimations: function () {
		this.boardAnimations = this.cancelAllAnimationsInArray(this.boardAnimations);
	},
	
	cancelGameAnimations: function () {
		this.gameAnimations = this.cancelAllAnimationsInArray(this.gameAnimations);
	},
	
	cancelAllAnimationsInArray: function (arr) {
		for (var i in arr) {
			arr[i].cancel();
		}
		return [];
	}
};

module.exports = Game;