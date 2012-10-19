/*

	Vector.js
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
 * Constructor
 * 
 * METHOD 1: by coordinates
 * @param Number x			OPTIONAL The x coordinate, defaults to 0
 * @param Number y			OPTIONAL The y coordinate, defaults to 0
 * @param Number z			OPTIONAL The z coordinate, defaults to 0
 *
 * METHOD 2: copy another Vector
 * @param Vector			OPTIONAL A Vector to copy
 *
 * METHOD 3: copy x, y, and z values from any object
 * @param Object			OPTIONAL An object to copy x, y, and z properties from
 */
function Vector() {
	var x, y, z, a = arguments;
	// check if a vector was passed
	if (isVector(a[0])) {
		x = a[0].x;
		y = a[0].y;
		z = a[0].z;
	} else if (a[0] instanceof Object) {
		x = a[0].hasOwnProperty('x') && parseFloat(a[0].x);
		y = a[0].hasOwnProperty('y') && parseFloat(a[0].y);
		z = a[0].hasOwnProperty('z') && parseFloat(a[0].z);
	} else {
		x = parseFloat(a[0]);
		y = parseFloat(a[1]);
		z = parseFloat(a[2]);
	}
	this.x = x || 0;
	this.y = y || 0;
	this.z = z || 0;
}


/**** INSTANCE METHODS ****/
Vector.prototype = {
	
	/**
	 * Adds a Vector to this Vector
	 * 
	 * @param Vector v			The Vector to add
	 * @return this
	 */
	add: function (v) {
		this.x += v.x;
		this.y += v.y;
		this.z += v.z;
		return this;
	},
	
	/**
	 * Subtracts a Vector from this Vector
	 * 
	 * @param Vector v			The Vector to subtract
	 * @return this
	 */
	subtract: function (v) {
		this.x -= v.x;
		this.y -= v.y;
		this.z -= v.z;
		return this;
	},
	
	
	/**
	 * Scales this Vector
	 * 
	 * @param Number s			The number to scale by
	 * @return this
	 */
	scale: function (s) {
		s = parseFloat(s) || 0;
		this.x *= s;
		this.y *= s;
		this.z *= s;
		return this;
	},
	
	/**
	 * Calculates the dot product of this Vector and the given Vector
	 *
	 * @param Vector v			The Vector to dot this with
	 * @return Number			The dot product
	 */
	dot: function (v) {
		return this.x * v.x + this.y * v.y + this.z * v.z;
	},
	
	/**
	 * Calculates the cross product of this Vector and the given Vector
	 *
	 * @param Vector v			The Vector to cross this with
	 * @return this
	 */
	cross: function (v) {
		var oldX = this.x,
			oldY = this.y,
			oldZ = this.z;
		this.x = oldY * v.z - v.y * oldZ;
		this.y = oldZ * v.x - v.z * oldX;
		this.z = oldX * v.y - v.x * oldY;
		return this;
	},

	/**
	 * Calculates the magnitude of this Vector
	 *
	 * @return Number			The magnitude
	 */
	magnitude: function () {
		return Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z);
	},
	
	/**
	 * Calculates and returns the unit vector of this Vector
	 *
	 * @return Vector			The unit vector
	 */
	unit: function () {
		return new Vector(this).scale(1/this.magnitude())
	},
	
	/**
	 * Calculates the orientation of this Vector about the Z axis
	 *
	 * @return Number			The orientation in radians
	 */
	orientationZ: function () {
		return Math.atan2(this.y, this.x);
	},
	
	/**
	 * Rotates this Vector about the Z axis
	 *
	 * @param Number t			The angle in radians to rotate by
	 * @return this
	 */
	rotateZ: function (t) {
		t = parseFloat(t) || 0;
		var oldX = this.x,
			oldY = this.y;
		this.x = oldX*Math.cos(t) - oldY*Math.sin(t);
		this.y = oldX*Math.sin(t) + oldY*Math.cos(t);
		return this;
	},
	
	/**
	 * Adds a scalar number to the magnitude of this Vector
	 *
	 * @param Number s			The number to add
	 * @return this
	 */
	addToMagnitude: function (s) {
		s = parseFloat(s) || 0;
		var mag = this.magnitude(),
			magTransformation = Math.sqrt((s + mag) / mag);
		this.x *= magTransformation;
		this.y *= magTransformation;
		this.z *= magTransformation;
		return this;
	},
	
	
	/**
	 * Projects this vector on to the given vector
	 *
	 * @param Vector v			The Vector to project this onto
	 * @return this
	 */
	project: function (v) {
		var dp = this.dot(v);
		this.x = (dp / (v.x*v.x + v.y*v.y + v.z*v.z)) * v.x;
		this.y = (dp / (v.x*v.x + v.y*v.y + v.z*v.z)) * v.y;
		this.z = (dp / (v.x*v.x + v.y*v.y + v.z*v.z)) * v.z;
		return this;
	},

	eq: function (v) {
		return this.x === v.x &&
				this.y === v.y &&
				this.z === v.z;
	},

	// Custom toJSON method so we don't send the z component (since we don't need it)
	toJSON: function () {
		return {
			x: this.x,
			y: this.y
		};
	}
};

/**** CLASS METHODS ****/

Vector.add = function (v1, v2) {
	return (new Vector(v1)).add(v2);
};
Vector.subtract = function (v1, v2) {
	return (new Vector(v1)).subtract(v2);
};
Vector.scale = function (v, s) {
	return (new Vector(v)).scale(s);
};
Vector.dot = function (v1, v2) {
	return v1.dot(v2);
};
Vector.cross = function (v1, v2) {
	return (new Vector(v1)).cross(v2);
};
Vector.magnitude = function (v) {
	return v.magnitude();
};
Vector.unit = function (v) {
	return v.unit();
};
Vector.orientationZ = function (v) {
	return v.orientationZ();
};
Vector.rotateZ = function (v, t) {
	return (new Vector(v)).rotateZ(t);
};
Vector.addToMagnitude = function (v, s) {
	return (new Vector(v)).addToMagnitude(s);
};
Vector.project = function (v1, v2) {
	return (new Vector(v1)).project(v2);
};
Vector.average = function () {
	var num, result = new Vector(), items = arguments;
	if (arguments[0] instanceof Array)
		items = arguments[0];
	num = items.length;
	for (i = 0; i < num;i++) {
		result.add(new Vector(items[i]));
	}
	return result.scale(1/num);
};

/**** i, j, k UNIT VECTORS ****/
Vector.i = new Vector(1, 0, 0);
Vector.j = new Vector(0, 1, 0);
Vector.k = new Vector(0, 0, 1);

function isVector(obj) {
	return obj instanceof Vector;
}

if ("object" === typeof module) {
	module.exports = Vector;
}