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



const string = require( 'string-kit' ) ;



const helpers = {} ;
module.exports = helpers ;



helpers.normalToRgb = function( normal , rgb = {} ) {
	rgb.r = Math.round( 255 * ( 1 + normal.x ) / 2 ) ;
	rgb.g = Math.round( 255 * ( 1 + normal.y ) / 2 ) ;
	rgb.b = Math.round( 255 * ( 1 - normal.z ) / 2 ) ;
	//console.warn( "Normal color:" , normal , rgb.r , rgb.g , rgb.b ) ;
	return rgb ;
} ;



const REUSABLE_RGB = {} ;

helpers.normalToRgbStr = function( normal , rgb = REUSABLE_RGB ) {
	helpers.normalToRgb( normal , rgb ) ;
	return string.format( '#%x%x%x' , rgb.r , rgb.g , rgb.b ) ;
} ;



// Create a new rect rebased to x,y origin
helpers.rebaseRect = ( rect , x , y ) => {
	return {
		xMin: rect.xMin - x ,
		xMax: rect.xMax - x ,
		yMin: rect.yMin - y ,
		yMax: rect.yMax - y
	} ;
} ;



helpers.multiplyInvAlpha = ( a , b ) => 1 - ( ( 1 - a ) * ( 1 - b ) ) ;
helpers.lerp = ( a , b , t ) => a + t * ( b - a ) ;
helpers.lerp2 = ( a , b , t , out ) => {
	out.x = a.x + t * ( b.x - a.x ) ;
	out.y = a.y + t * ( b.y - a.y ) ;
} ;

