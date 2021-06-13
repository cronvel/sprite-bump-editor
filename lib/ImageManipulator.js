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



function ImageManipulator( object , width , height , channels = 4 , data = null ) {
	this.object = object || null ;
	this.width = width || this.object?.width || 1 ;
	this.height = height || this.object?.height || 1 ;
	this.channels = channels || 4 ;
	this.data = data || this.object?.data || new Uint8ClampedArray( this.width * this.height * this.channels ) ;
	
	if ( this.channels === 4 ) {
		this.setPixel = this.setPixelRgba ;
	}
	else {
		this.setPixelIfGreaterAlpha = this.setPixel ;
	}
}

module.exports = ImageManipulator ;



ImageManipulator.prototype.clone = function() { return this.copyTo() ; } ;
ImageManipulator.prototype.getOffset = function( x , y ) { return this.channels * ( y * this.width + x ) ; } ;

ImageManipulator.prototype.clear = function() {
	for ( var i = 0 , iMax = this.data.length ; i < iMax ; i ++ ) { this.data[ i ] = 0 ; }
} ;

ImageManipulator.prototype.intensityAtOffset = function( offset ) {
	return ( this.data[ offset ] + this.data[ offset + 1 ] + this.data[ offset + 2 ] ) / 765 ;	// = avg(r,g,b)/255
} ;



ImageManipulator.prototype.getClampedOffset = function( x , y ) {
	if ( x < 0 ) { x = 0 ; }
	else if ( x >= this.width ) { x = this.width - 1 ; }

	if ( y < 0 ) { y = 0 ; }
	else if ( y >= this.height ) { y = this.height - 1 ; }

	return this.channels * ( y * this.width + x ) ;
} ;



ImageManipulator.prototype.setPixel = function( x , y , ... args ) {
	var offset = this.channels * ( y * this.width + x ) ;
	for ( let i = 0 ; i < this.channels ; i ++ ) { this.data[ offset + i ] = args[ i ] ; }
} ;



ImageManipulator.prototype.setPixelRgba = function( x , y , r , g , b , a ) {
	var offset = this.channels * ( y * this.width + x ) ;
	this.data[ offset ] = r ;
	this.data[ offset + 1 ] = g ;
	this.data[ offset + 2 ] = b ;
	this.data[ offset + 3 ] = a ;
} ;



ImageManipulator.prototype.setPixelIfGreaterAlpha = function( x , y , r , g , b , a ) {
	var offset = this.channels * ( y * this.width + x ) ;
	if ( this.data[ offset + 3 ] >= a ) { return ; }
	this.data[ offset ] = r ;
	this.data[ offset + 1 ] = g ;
	this.data[ offset + 2 ] = b ;
	this.data[ offset + 3 ] = a ;
} ;



ImageManipulator.prototype.disc = function( cx , cy , hardRadius , softRadius , color ) {
	var x , y , dx , dy , d , alpha ,
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
			alpha = color.a ;
			alpha = this.alphaDecay( alpha , d , hardRadius , softRadius ) ;
			this.setPixelIfGreaterAlpha( x , y , color.r , color.g , color.b , alpha ) ;
		}
	}
} ;



ImageManipulator.prototype.thickLine = function( fromX , fromY , toX , toY , hardThickness , softThickness , color ) {
	if ( fromX === toX || fromY === toY ) {
		return this.disc( fromX , fromY , hardThickness , softThickness , color ) ;
	}

	var x , y , dx , dy , d ,
		lineDistance , segmentProjection , alpha ,
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
				alpha = this.alphaDecay( alpha , d , hardThickness , softThickness ) ;
				this.setPixelIfGreaterAlpha( x , y , color.r , color.g , color.b , alpha ) ;
				continue ;
			}

			lineDistance = segment.lineDistance( x , y ) ;
			if ( lineDistance >= softThickness ) { continue ; }
			alpha = this.alphaDecay( alpha , lineDistance , hardThickness , softThickness ) ;
			this.setPixelIfGreaterAlpha( x , y , color.r , color.g , color.b , alpha ) ;
		}
	}
} ;



ImageManipulator.prototype.copyTo = function( to , rect ) {
	var x , y , c , channels , offset , toOffset ;

	if ( ! to ) { to = new ImageManipulator( null , this.width , this.height ) ; }
	else if ( ! ( to instanceof ImageManipulator ) ) { to = new ImageManipulator( to ) ; }

	if ( ! rect ) {
		rect = {
			xMin: 0 , xMax: this.width - 1 , yMin: 0 , yMax: this.height - 1
		} ;
	}
	
	channels = Math.min( this.channels , to.channels ) ;

	for ( y = rect.yMin ; y <= rect.yMax ; y ++ ) {
		for ( x = rect.xMin ; x <= rect.xMax ; x ++ ) {
			offset = this.getOffset( x , y ) ;
			toOffset = to.getOffset( x , y ) ;

			for ( c = 0 ; c < channels ; c ++ ) {
				to.data[ toOffset + c ] = this.data[ offset + c ] ;
			}
		}
	}

	return to ;
} ;



// Like .copyTo but alpha-aware (require RGBA)
ImageManipulator.prototype.mergeInto = function( to , rect , forceOpaque = false ) {
	var x , y , offset , toOffset , selfR , selfG , selfB , selfA , selfInvA , toR , toG , toB , toA ;

	if ( ! to ) { to = new ImageManipulator( null , this.width , this.height ) ; }
	else if ( ! ( to instanceof ImageManipulator ) ) { to = new ImageManipulator( to ) ; }

	if ( ! rect ) {
		rect = {
			xMin: 0 , xMax: this.width - 1 , yMin: 0 , yMax: this.height - 1
		} ;
	}

	for ( y = rect.yMin ; y <= rect.yMax ; y ++ ) {
		for ( x = rect.xMin ; x <= rect.xMax ; x ++ ) {
			offset = this.getOffset( x , y ) ;
			toOffset = to.getOffset( x , y ) ;

			// Filter transparency out now
			selfA = this.data[ offset + 3 ] / 255 ;
			if ( ! selfA ) { continue ; }

			selfR = this.data[ offset ] ;
			selfG = this.data[ offset + 1 ] ;
			selfB = this.data[ offset + 2 ] ;
			//if ( ! selfR && ! selfG && ! selfB ) { continue ; }
			selfInvA = 1 - selfA ;
			toR = to.data[ toOffset ] ;
			toG = to.data[ toOffset + 1 ] ;
			toB = to.data[ toOffset + 2 ] ;
			to.data[ toOffset ] = Math.round( selfR * selfA + toR * selfInvA ) ;
			to.data[ toOffset + 1 ] = Math.round( selfG * selfA + toG * selfInvA ) ;
			to.data[ toOffset + 2 ] = Math.round( selfB * selfA + toB * selfInvA ) ;

			if ( forceOpaque ) {
				to.data[ toOffset + 3 ] = 255 ;
			}
			else {
				//toA = to.data[ toOffset + 3 ] / 255 ;
				//to.data[ toOffset + 3 ] = Math.round( 255 * helpers.multiplyInvAlpha( selfA , toA ) ) ;
				to.data[ toOffset + 3 ] = this.data[ offset + 3 ] ;
			}
		}
	}

	return to ;
} ;



//*
const REUSABLE_NORMAL = { x: 0 , y: 0 , z: 0 } ;
const REUSABLE_RGB = { r: 0 , g: 0 , b: 0 } ;

ImageManipulator.prototype.toNormal = function( to , rect , zRate = 0.5 ) {
	var x , y , offset , toOffset , selfA ,
		topLeft , top , topRight , left , right , bottomLeft , bottom , bottomRight ,
		normal = REUSABLE_NORMAL ,
		toRgb = REUSABLE_RGB ;

	if ( ! to ) { to = new ImageManipulator( null , this.width , this.height ) ; }
	else if ( ! ( to instanceof ImageManipulator ) ) { to = new ImageManipulator( to ) ; }

	if ( ! rect ) {
		rect = {
			xMin: 0 , xMax: this.width - 1 , yMin: 0 , yMax: this.height - 1
		} ;
	}

	for ( y = rect.yMin ; y <= rect.yMax ; y ++ ) {
		for ( x = rect.xMin ; x <= rect.xMax ; x ++ ) {
			offset = this.getOffset( x , y ) ;
			toOffset = to.getOffset( x , y ) ;

			// Filter transparency out now
			selfA = this.data[ offset + 3 ] / 255 ;
			if ( ! selfA ) {
				// Transparent area, set it to default normal
				to.data[ toOffset ] = 128 ;
				to.data[ toOffset + 1 ] = 128 ;
				to.data[ toOffset + 2 ] = 255 ;
				to.data[ toOffset + 3 ] = 255 ;
				continue ;
			}

			// surrounding pixels
			topLeft = this.intensityAtOffset( this.getClampedOffset( x - 1 , y - 1 ) ) ;
			top = this.intensityAtOffset( this.getClampedOffset( x , y - 1 ) ) ;
			topRight = this.intensityAtOffset( this.getClampedOffset( x + 1 , y - 1 ) ) ;
			left = this.intensityAtOffset( this.getClampedOffset( x - 1 , y ) ) ;
			right = this.intensityAtOffset( this.getClampedOffset( x + 1 , y ) ) ;
			bottomLeft = this.intensityAtOffset( this.getClampedOffset( x - 1 , y + 1 ) ) ;
			bottom = this.intensityAtOffset( this.getClampedOffset( x , y + 1 ) ) ;
			bottomRight = this.intensityAtOffset( this.getClampedOffset( x + 1 , y + 1 ) ) ;

			// “Sobel” filter
			normal.x = ( topRight + 2 * right + bottomRight ) - ( topLeft + 2 * left + bottomLeft ) ;
			normal.y = ( bottomLeft + 2 * bottom + bottomRight ) - ( topLeft + 2 * top + topRight ) ;
			normal.z = zRate ;

			helpers.normalizeVector( normal ) ;
			helpers.normalToRgb( normal , toRgb ) ;

			to.data[ toOffset ] = toRgb.r ;
			to.data[ toOffset + 1 ] = toRgb.g ;
			to.data[ toOffset + 2 ] = toRgb.b ;
			to.data[ toOffset + 3 ] = 255 ;
		}
	}

	return to ;
} ;
//*/



// To generate the normal map from this texture:
// https://stackoverflow.com/questions/2368728/can-normal-maps-be-generated-from-a-texture



// Internal: alpha decay for a brush softness
ImageManipulator.prototype.alphaDecay = function( alpha , distance , hard , soft ) {
	if ( distance <= hard ) { return alpha ; }

	// Linear
	var decay = ( soft - distance ) / ( soft - hard ) ;
	// Transform to square root
	decay = Math.sqrt( decay ) ;

	// Using round formula (result is not very satisfying)
	//var decay = ( distance - hard ) / ( soft - hard ) ;
	// decay = Math.sqrt( 1 - decay * decay ) ;

	return Math.round( alpha * decay ) ;
} ;

