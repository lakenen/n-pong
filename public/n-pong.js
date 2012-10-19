
Math.clamp = function (a, b, c) {
	if (c < a) return a;
	if (c > b) return b;
	return c;
};

CanvasRenderingContext2D.prototype.fillRoundedRect = function (x, y, w, h, r) {
	this.beginPath();
	this.moveTo(x+r, y);
	this.lineTo(x+w-r, y);
	this.quadraticCurveTo(x+w, y, x+w, y+r);
	this.lineTo(x+w, y+h-r);
	this.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
	this.lineTo(x+r, y+h);
	this.quadraticCurveTo(x, y+h, x, y+h-r);
	this.lineTo(x, y+r);
	this.quadraticCurveTo(x, y, x+r, y);
	this.closePath();
	this.fill();
};

CanvasRenderingContext2D.prototype.fillCircle = function (x, y, r) {
	this.beginPath();
	this.arc(x, y, r, 0, Math.PI*2, true);
	this.closePath();
	this.fill();
};


function NPong(opt) {
	var options = {
		host: 'http://localhost:8000',
		join: false
	};
	$.extend(options, opt);
	if (options.gameId) options.join = true;

	// canvas must be defined
	if (!(options.canvas instanceof HTMLCanvasElement))
		throw 'canvas is not a Canvas';
	try {
		// open a socket connection
		socket = io.connect(options.host, {'sync disconnect on unload' : true});
	} catch (e) {
		console.log(e);
		alert("Your browser doesn't support websockets! Try the latest version of chrome or safari!");
	}
	var mouseMoved = true;
	var Mouse = null;
	var gameOffset = new Vector();
	var playing = false;
	var ctx = options.canvas.getContext('2d');

	var gameConfig = {
		gameId: options.gameId
	};
	var gameState = {
		b: [],
		pp: [],
		p: []
	};

	// we are joining?
	if (options.join) {
		if (gameConfig.gameId) {
			socket.emit('join', {
				id: gameConfig.gameId
			});
		} else {
			// join random if possible
			socket.emit('join');
		}
	} else {
		// new game!
		socket.emit('create', {name:'test'});
	}

	socket.on('info', function (data) {
		// game config was sent back to us
		gameConfig = data;
		window.location.hash = gameConfig.gameId;
		if (opt.onJoin) opt.onJoin(data);
		start();
	});
	socket.on('update', function (data) {
		// update stuff!
		$.extend(gameState, data);
	});
	socket.on('kick', function () {
		alert('You were kicked from the game due to inactivity!');
		gameState = {
			b: [],
			pp: [],
			p: []
		};
	});


	var d = 0;
	function update() {
		var balls = gameState.b,
			players = gameState.pp,
			board = gameState.p;
		//d+=50;
		d++;
		// reset/clear the canvas
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

		ctx.save();

		if (players.length < 2) {
			playing = false;
			return;
		} else {
			playing = true;
		}

		var Center = Vector.average(board);
		var grad = ctx.createRadialGradient(Center.x, Center.y, 0, Center.x, Center.y, 320);
		grad.addColorStop(0, 'hsl('+(Math.floor(d/5)%360)+',50%,35%)');
		grad.addColorStop(1, 'hsl('+(Math.floor(d/5)%360)+',50%,10%)');

		// draw the board
		ctx.fillStyle = grad;
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(board[0].x, board[0].y);
		for (var i = 1; i < board.length; i++) {
			ctx.lineTo(board[i].x, board[i].y);
		}
		ctx.lineTo(board[0].x, board[0].y);
		ctx.fill();

		// draw each player
		ctx.fillStyle  = 'white';
		for (var i = 0; i < players.length; i++) {
			ctx.save();
			if (i === gameState.me) {
				ctx.fillStyle  = 'hsl('+(Math.floor((d/5)+180)%360)+',80%,50%)';
			}

			// translate the canvas to the paddle's x,y coords
			ctx.translate(players[i].x, players[i].y);

			// rotate the canvas by the paddle's theta
			ctx.rotate(players[i].t);
			ctx.fillRoundedRect(
				-gameConfig.paddleLength / 2,
				-gameConfig.paddleThickness / 2,
				gameConfig.paddleLength,
				gameConfig.paddleThickness,
				gameConfig.paddleThickness / 2
			);
			ctx.font = gameConfig.paddleThickness+'px Arial';
			ctx.fillStyle = 'black';
			var txtLen = ctx.measureText(players[i].s).width;
			ctx.fillText(players[i].s, -txtLen/2, gameConfig.paddleThickness/2 - 2);
			ctx.restore();
		}

		// draw the balls
		for (var i = 0; i < balls.length; i++) {
			ctx.fillCircle(balls[i].x, balls[i].y, gameConfig.ballRadius);
		}
		ctx.restore();
	}

	//M is the mouse position
	//Returns the point where the paddle should be, based on M
	function getPaddleLocation(M) {
		// adjust M for gameOffset
		M.subtract(gameOffset);
		var A, B;
		if (gameState.pp.length > 2) {
			A = new Vector(gameState.p[gameState.me].x, gameState.p[gameState.me].y);
			B = new Vector(gameState.p[(gameState.me+1)%gameState.p.length].x, gameState.p[(gameState.me+1)%gameState.p.length].y);
		} else {
			// 2 player case
			A = new Vector(gameState.p[gameState.me*2].x, gameState.p[gameState.me*2].y);
			B = new Vector(gameState.p[gameState.me*2 + 1].x, gameState.p[gameState.me*2 + 1].y);
		}
		var AM = Vector.subtract(M, A),
			AB = Vector.subtract(B, A),
			ab2 = Vector.dot(AB, AB),
			am_ab = Vector.dot(AM, AB),
			t = Math.clamp(0, 1, am_ab / ab2);

		return Vector.add(A, Vector.scale(AB, t));
	}

	function mousemove(e) {
		// figure out where to put the paddle based on mouse position
		if (playing) {
			var x = e.clientX || e.originalEvent.touches && e.originalEvent.touches[0].clientX,
				y = e.clientY || e.originalEvent.touches && e.originalEvent.touches[0].clientY;
			Mouse = getPaddleLocation(new Vector(x, y));
		}
		mouseMoved = true;
		e.stopPropagation();
		e.preventDefault();
	}

	$(document).mousemove(mousemove).bind('touchmove', mousemove);

	function centerGame() {
		var x = Math.floor(($(window).width() - gameConfig.canvasWidth)/2),
			y = Math.floor(($(window).height() - gameConfig.canvasHeight)/2);
		if (x < 10) x = 10;
		if (y < 10) y = 10;
		gameOffset = new Vector(x, y);
		$(ctx.canvas).css({
			left: x+'px',
			top: y+'px'
		});
	}


	function start() {
		//gameConfig.canvasWidth += 100;
		//gameConfig.canvasHeight += 100;

		// internal canvas width and height
		ctx.canvas.width = gameConfig.canvasWidth;
		ctx.canvas.height = gameConfig.canvasHeight;
		// html canvas element width and height
		$(ctx.canvas).width(gameConfig.canvasWidth);
		$(ctx.canvas).height(gameConfig.canvasHeight);

		$(window).resize(centerGame);
		centerGame();

		function _update() {
			update();
			requestAnimationFrame(_update);
		}
		_update();
		setInterval(function () {
			// don't send update if mouse hasn't moved or we don't yet have a gameId
			if (Mouse && mouseMoved && playing) {
				console.log('sending update');
				socket.emit('update', {
					x: Mouse.x,
					y: Mouse.y,
					g: gameConfig.gameId
				});
			}
			mouseMoved = false;
		}, 30);

	}

	this.state = function () {
		return gameState;
	};
}
