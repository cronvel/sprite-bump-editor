/*
	Sprite Bump Editor

	Copyright (c) 2021 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



// ax + by + c = 0 with a,b normalized, so | ax + by + c | is the distance to the line
function Segment( fromX , fromY , toX , toY ) {
	var tmp ,
		vx = toX - fromX ,
		vy = toY - fromY ;
	this.norm = Math.sqrt( vx * vx + vy * vy ) ;

	// Normalyze vx,vy
	vx /= this.norm ;
	vy /= this.norm ;
	
	this.a = - vy ;
	this.b = vx ;
	this.c = - vx * fromY + vy * fromX ;
	
	// Now the orthogonal line equation
	this.orthoA = vx ;
	this.orthoB = vy ;
	this.orthoC = - vy * fromY - vx * fromX ;
}

module.exports = Segment ;



Segment.prototype.lineDistance = function( x , y ) {
	return Math.abs( this.a * x + this.b * y + this.c ) ;
} ;

Segment.prototype.projection = function( x , y ) {
	return this.orthoA * x + this.orthoB * y + this.orthoC ;
} ;

