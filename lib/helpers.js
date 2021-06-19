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



helpers.rgbToNormal = ( rgb , normal = {} ) => {
	normal.x = rgb.r / 127.5 - 1 ;
	normal.y = rgb.g / 127.5 - 1 ;
	normal.z = rgb.b / 127.5 - 1 ;
	// Normalize again, it can have some errors due to low precision of rgb 8bit per channel
	helpers.normalizeVector( normal ) ;
	//console.warn( "Normal:" , rgb , normal.x , normal.y , normal.z ) ;
	return normal ;
} ;



helpers.normalToRgb = ( normal , rgb = {} ) => {
	rgb.r = Math.round( 127.5 * ( 1 + normal.x ) ) ;
	rgb.g = Math.round( 127.5 * ( 1 + normal.y ) ) ;
	rgb.b = Math.round( 127.5 * ( 1 + normal.z ) ) ;
	//console.warn( "Normal color:" , normal , rgb.r , rgb.g , rgb.b ) ;
	return rgb ;
} ;



const REUSABLE_RGB = {} ;

helpers.normalToRgbStr = ( normal , rgb = REUSABLE_RGB ) => {
	helpers.normalToRgb( normal , rgb ) ;
	return string.format( '#%x%x%x' , rgb.r , rgb.g , rgb.b ) ;
} ;



// Output RGB with values between 0 and 1
helpers.normalizeRgb = ( rgb , nRgb = {} ) => {
	nRgb.r = rgb.r / 255 ;
	nRgb.g = rgb.g / 255 ;
	nRgb.b = rgb.b / 255 ;
	if ( rgb.a ) { nRgb.a = rgb.a / 255 ; }
	return nRgb ;
} ;



// Output RGB with values between 0 and 255
helpers.denormalizeRgb = ( nRgb , rgb = {} ) => {
	rgb.r = Math.round( nRgb.r * 255 ) ;
	rgb.g = Math.round( nRgb.g * 255 ) ;
	rgb.b = Math.round( nRgb.b * 255 ) ;
	if ( nRgb.a ) { rgb.a = Math.round( nRgb.a * 255 ) ; }
	return rgb ;
} ;



helpers.normalizeVector = ( vector ) => {
	var d = Math.sqrt( vector.x * vector.x + vector.y * vector.y + vector.z * vector.z ) ;
	if ( ! d ) {
		vector.x = vector.y = 0 ;
		vector.z = 1 ;	// Normalize to default surface normal
	}
	else {
		vector.x /= d ;
		vector.y /= d ;
		vector.z /= d ;
	}
	return vector ;
} ;



helpers.rgbIntensity = ( r , g , b ) => ( r + g + b ) / 765 ;	// = avg(r,g,b)/255



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
helpers.bilinearLerp = ( c00 , c10 , c01 , c11 , tx , ty ) =>
	helpers.lerp( helpers.lerp( c00 , c10 , tx ) , helpers.lerp( c01 , c11 , tx ) , ty ) ;

