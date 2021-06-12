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



const Segment = require( './Segment.js' ) ;
const helpers = require( './helpers.js' ) ;



function ImageManipulator( object , data , width , height ) {
	this.object = object || null ;
	this.width = width || this.object?.width || 1 ;
	this.height = height || this.object?.height || 1 ;
	this.data = data || this.object?.data || new Uint8ClampedArray( this.width * this.height * 4 ) ;
}

module.exports = ImageManipulator ;



ImageManipulator.prototype.getOffset = function( x , y ) {
	return 4 * ( y * this.width + x ) ;
} ;

ImageManipulator.prototype.clear = function() {
	for ( var i = 0 , iMax = this.data.length ; i < iMax ; i ++ ) { this.data[ i ] = 0 ; }
} ;



ImageManipulator.prototype.setPixel = function( x , y , r , g , b , a ) {
	var offset = 4 * ( y * this.width + x ) ;
	this.data[ offset ] = r ;
	this.data[ offset + 1 ] = g ;
	this.data[ offset + 2 ] = b ;
	this.data[ offset + 3 ] = a ;
} ;



ImageManipulator.prototype.setPixelIfGreaterAlpha = function( x , y , r , g , b , a ) {
	var offset = 4 * ( y * this.width + x ) ;
	if ( this.data[ offset + 3 ] >= a ) { return ; }
	this.data[ offset ] = r ;
	this.data[ offset + 1 ] = g ;
	this.data[ offset + 2 ] = b ;
	this.data[ offset + 3 ] = a ;
} ;



ImageManipulator.prototype.getRgbaArray = function( x , y ) {
	var offset = this.getOffset( x , y ) ;

	return [
		this.data[ offset ] ,
		this.data[ offset + 1 ] ,
		this.data[ offset + 2 ] ,
		this.data[ offset + 3 ]
	] ;
} ;



ImageManipulator.prototype.disc = function( cx , cy , hardRadius , softRadius , color ) {
	var x , y , dx , dy , d , alpha ,
		radiusDelta = softRadius - hardRadius ,
		xMin = Math.max( 0 , Math.floor( cx - softRadius ) ) ,
		xMax = Math.min( this.width - 1 , Math.ceil( cx + softRadius ) ) ,
		yMin = Math.max( 0 , Math.floor( cy - softRadius ) ) ,
		yMax = Math.min( this.height - 1 , Math.ceil( cy + softRadius ) ) ;
	//console.warn( ".disc()" , cx , cy , hardRadius , softRadius , color , xMin , xMax , yMin , yMax ) ;

	for ( y = yMin ; y <= yMax ; y ++ ) {
		dy = y - cy ;

		for ( x = xMin ; x <= xMax ; x ++ ) {
			dx = x - cx ;
			d = Math.sqrt( dx * dx + dy * dy ) ;
			if ( d >= softRadius ) { continue ; }
			alpha = d <= hardRadius ? color.a : Math.round( color.a * ( softRadius - d ) / radiusDelta ) ;
			if ( alpha ) { this.setPixelIfGreaterAlpha( x , y , color.r , color.g , color.b , alpha ) ; }
		}
	}
} ;



ImageManipulator.prototype.thickLine = function( fromX , fromY , toX , toY , hardThickness , softThickness , color ) {
	if ( fromX === toX || fromY === toY ) {
		return this.disc( fromX , fromY , hardThickness , softThickness , color ) ;
	}

	var x , y , dx , dy , d ,
		lineDistance , segmentProjection , alpha ,
		thicknessDelta = softThickness - hardThickness ,
		segment = new Segment( fromX , fromY , toX , toY ) ,
		xMin = Math.max( 0 , Math.floor( Math.min( fromX , toX ) - softThickness ) ) ,
		xMax = Math.min( this.width - 1 , Math.ceil( Math.max( fromX , toX ) + softThickness ) ) ,
		yMin = Math.max( 0 , Math.floor( Math.min( fromY , toY ) - softThickness ) ) ,
		yMax = Math.min( this.height - 1 , Math.ceil( Math.max( fromY , toY ) + softThickness ) ) ;
	//console.warn( ".disc()" , cx , cy , hardThickness , softThickness , color , xMin , xMax , yMin , yMax ) ;

	for ( y = yMin ; y <= yMax ; y ++ ) {
		for ( x = xMin ; x <= xMax ; x ++ ) {
			alpha = color.a ;
			segmentProjection = segment.projection( x , y ) ;

			if ( segmentProjection < 0 || segmentProjection > segment.norm ) {
				// This is the end cap, use a round cap
				if ( segmentProjection < 0 ) {
					dx = x - fromX ;
					dy = y - fromY ;
				}
				else {
					dx = x - toX ;
					dy = y - toY ;
				}

				d = Math.sqrt( dx * dx + dy * dy ) ;
				if ( d >= softThickness ) { continue ; }
				alpha = d <= hardThickness ? color.a : Math.round( color.a * ( softThickness - d ) / thicknessDelta ) ;
				if ( alpha ) { this.setPixelIfGreaterAlpha( x , y , color.r , color.g , color.b , alpha ) ; }
				continue ;
			}

			lineDistance = segment.lineDistance( x , y ) ;
			if ( lineDistance >= softThickness ) { continue ; }
			if ( lineDistance > hardThickness ) { alpha = Math.round( alpha * ( softThickness - lineDistance ) / thicknessDelta ) ; }
			if ( alpha ) { this.setPixelIfGreaterAlpha( x , y , color.r , color.g , color.b , alpha ) ; }
		}
	}
} ;



ImageManipulator.prototype.copyTo = function( to , rect , forceOpaque = false ) {
	var x , y , offset , selfR , selfG , selfB , selfA , selfInvA , toR , toG , toB , toA ;

	for ( y = rect.yMin ; y < rect.yMax ; y ++ ) {
		for ( x = rect.xMin ; x < rect.xMax ; x ++ ) {
			offset = this.getOffset( x , y ) ;

			// Filter transparency out now
			selfA = this.data[ offset + 3 ] / 255 ;
			if ( ! selfA ) { continue ; }

			selfR = this.data[ offset ] ;
			selfG = this.data[ offset + 1 ] ;
			selfB = this.data[ offset + 2 ] ;
			if ( ! selfR && ! selfG && ! selfB ) { continue ; }
			selfInvA = 1 - selfA ;
			toR = to.data[ offset ] ;
			toG = to.data[ offset + 1 ] ;
			toB = to.data[ offset + 2 ] ;
			to.data[ offset ] = Math.round( selfR * selfA + toR * selfInvA ) ;
			to.data[ offset + 1 ] = Math.round( selfG * selfA + toG * selfInvA ) ;
			to.data[ offset + 2 ] = Math.round( selfB * selfA + toB * selfInvA ) ;

			if ( forceOpaque ) {
				to.data[ offset + 3 ] = 255 ;
			}
			else {
				//toA = to.data[ offset + 3 ] / 255 ;
				//to.data[ offset + 3 ] = Math.round( 255 * helpers.multiplyInvAlpha( selfA , toA ) ) ;
				to.data[ offset + 3 ] = this.data[ offset + 3 ] ;
			}
		}
	}

	return to ;
} ;

