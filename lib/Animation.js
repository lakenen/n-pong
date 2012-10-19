/*!

	Animation.js
	Version 2.1.0
	Copyright 2012 Cameron Lakenen
	
	Permission is hereby granted, free of charge, to any person obtaining
	a copy of this software and associated documentation files (the
	"Software"), to deal in the Software without restriction, including
	without limitation the rights to use, copy, modify, merge, publish,
	distribute, sublicense, and/or sell copies of the Software, and to
	permit persons to whom the Software is furnished to do so, subject to
	the following conditions:
	
	The above copyright notice and this permission notice shall be
	included in all copies or substantial portions of the Software.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
	EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
	NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
	LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
	OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
	WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

**/
/**
 *
 * Changelog:
 * 
 * Version 2.1.0
 * - Added Name property to transitions
 * - Added Transitions.Random()
 * 
 * Version 2.0.0
 * - Added support for requestAnimationFrame and cancel[Request]AnimationFrame
 * 
**/

window = typeof window !== 'undefined' ? window : global || this;

// requestAnimationFrame polyfill by Erik Mšller
// fixes from Paul Irish and Tino Zijdel
(function() {
	var lastTime = 0;
	var vendors = ['ms', 'moz', 'webkit', 'o'];
	for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
		window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
		window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] 
								   || window[vendors[x]+'CancelRequestAnimationFrame'];
	}
 
	if (!window.requestAnimationFrame) {
		window.requestAnimationFrame = function(callback, element) {
			var currTime = new Date().getTime();
			var timeToCall = Math.max(0, 16 - (currTime - lastTime));
			var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 
			  timeToCall);
			lastTime = currTime + timeToCall;
			return id;
		};
	}
	if (!window.cancelAnimationFrame) {
		window.cancelAnimationFrame = function(id) {
			clearTimeout(id);
		};
	}
}());

var Animation = (function() {
	/*
	 * Class helper adapted from Steffen Rusitschka's Closure-Class Helper:
	 * http://www.ruzee.com/blog/2008/12/javascript-inheritance-via-prototypes-and-closures
	 * Which is licensed under Creative Commons Attribution 3.0
	 * (http://creativecommons.org/licenses/by/3.0/)
	 */
	var Class = function() {
	};
	Class.create = function(constructor) {
		var k = this;
		var c = function() {
			this._super = k;
			var pubs = constructor.apply(this, arguments), self = this;
			for (key in pubs)
				(function(fn, sfn) {
					self[key] = typeof fn != "function"
							|| typeof sfn != "function" ? fn: function() {
						this._super = sfn;
						return fn.apply(this, arguments);
					};
				})(pubs[key], self[key]);
		};
		c.prototype = new this;
		c.prototype.constructor = c;
		c.extend = this.extend || this.create;
		return c;
	};

	// returns a new object that is created by merging all argument objects
	function mergeObjects() {
		var out = {};
		for ( var i = 0, len = arguments.length; i < len; ++i) {
			for ( var attrname in arguments[i]) {
				out[attrname] = arguments[i][attrname];
			}
		}
		return out;
	}

	var animations = [], frame_id = null;

	function add(animation) {
		animations.push(animation);
		startAnimations();
	}

	function remove(animation) {
		for ( var i = 0, len = animations.length; i < len; i++) {
			if (animations[i] === animation) {
				animations.splice(i, 1);
				break;
			}
		}
		if (animations.length == 0) {
			stopAnimations();
		}
	}
	
	function startAnimations() {
		if (!frame_id) {
			loop();
		}
	}
	function stopAnimations() {
		cancelAnimationFrame(frame_id);
		frame_id = null;
	}

	function loop() {
		frame_id = requestAnimationFrame(loop);
		var time = (new Date()).getTime();
		for ( var i = 0, len = animations.length; i < len; i++)
			animations[i] && animations[i].loop && animations[i].loop(time);
	}

	function buildTransition(transition, name) {
		transition.EaseIn = function(p) {
			return 1 - transition(1 - p);
		};
		transition.EaseOut = transition;
		transition.EaseIn.Name = name + ' (Ease In)';
		transition.EaseOut.Name = name + ' (Ease Out)';
		return transition;
	}
	
	function isFn(fn) {
		return typeof fn === 'function';
	}
	var allTransitions = [];
	var Animation = {
		Transitions: {
			Random: function () {
				return allTransitions[Math.floor(Math.random() * allTransitions.length)];
			}
		},

		cancelAll: function() {
			for ( var a in animations)
				animations[a].cancel();
			animations = [];
			stopAnimations();
		},

		addTransitions: function(transitions) {
			for ( var t in transitions) {
				var transition = transitions[t];
				this.Transitions[t] = buildTransition(transition, t);
				allTransitions.push(this.Transitions[t].EaseIn);
				allTransitions.push(this.Transitions[t].EaseOut);
			}
		},

		extend: function() {
			return Animation.Base.extend.apply(Animation.Base, arguments);
		}
	};

	Animation.addTransitions({
		// each of these are the easeOut (default) versions of the transition
		Back: function(p) {
			var s = 1.70158;
			return (p -= 1) * p * ((s + 1) * p + s) + 1;
		},
		Bounce: function(p) {
			var a = 7.5625, d = 2.75;
			if (p < (1 / d)) {
				return a * p * p;
			} else if (p < (2 / d)) {
				return a * (p -= (1.5 / d)) * p + 0.75;
			} else if (p < (2.5 / d)) {
				return a * (p -= (2.25 / d)) * p + 0.9375;
			} else {
				return a * (p -= (2.625 / d)) * p + 0.984375;
			}
		},
		Elastic: function(p) {
			return 1 - (Math.cos(p * 4.5 * Math.PI) * Math.exp(-p * 6));
		},
		Exponential: function(p) {
			return (p === 1) ? p : (-Math.pow(2, -10 * p) + 1);
		},
		Linear: function(p) {
			return p;
		},
		Sine: function(p) {
			return Math.sin(p * Math.PI / 2);
		}
	});

	// abstract animation class. must be extended
	Animation.Base = Class.create(function(options) {
		var defaultOptions = {
			duration: 1.0,
			delay: 0.0,
			fps: 100,
			transition: Animation.Transitions.Exponential
		};
		this.options = mergeObjects({}, defaultOptions, options || {});
		var starts = (new Date()).getTime() + (this.options.delay * 1000),
			duration = this.options.duration * 1000,
			ends = starts + duration,
			currentFrame = 0,
			totalFrames = this.options.duration * this.options.fps,
			position = 0,
			self = this,
			onStartCalled = false;
		
		// defer adding it until this function returns
		setTimeout(function () { add(self); }, 1);

		return {
			loop: function(time) {
				if (time >= starts) {
					if (!onStartCalled && isFn(this.options.onStart)) {
						onStartCalled = true;
						this.options.onStart();
					}
					if (time >= ends) {
						this.render(1.0);
						this.cancel();
						if (isFn(this.options.onFinish))
							this.options.onFinish();
						return;
					}
					var pos = (time - starts) / duration,
						frame = Math.round(pos * totalFrames);
					if (frame > currentFrame) {
						this.render(pos);
						currentFrame = frame;
					}
				}
			},

			render: function(pos) {
				position = this.options.transition(pos);
				if (isFn(this.update)) {
					if (isFn(this.options.onBeforeUpdate))
						this.options.onBeforeUpdate();
					
					this.update(position);
					
					if (isFn(this.options.onAfterUpdate))
						this.options.onAfterUpdate();
					else if (isFn(this.options.onUpdate))
						this.options.onUpdate();
				} else
					this.cancel();
			},

			cancel: function() {
				remove(this);
			},
			
			finished: function () {
				return currentFrame >= totalFrames;
			},
			
			finish: function () {
				this.loop(ends);
			}
		};
	});

	// transform an object
	Animation.Transform = Animation
			.extend(function(object, options) {
				this._super(options);
				var from = mergeObjects({}, options.from && mergeObjects(object, options.from) || object),
					to = options.to || {};
				function _update(obj, from, to, pos) {
					for ( var attr in to) {
						if (from.hasOwnProperty(attr)) {
							if (typeof to[attr] === 'object'
									&& typeof from[attr] === 'object') {
								_update(obj[attr], from[attr], to[attr], pos);
							} else if (typeof to[attr] === 'number') {
								obj[attr] = ((to[attr] - from[attr]) * pos)
										+ from[attr];
							}
						}
					}
				}
				return {
					update: function(pos) {
						_update(object, from, to, pos);
					}
				};
			});

	return Animation;
})();


if ("object" === typeof module) {
	module.exports = Animation;
}