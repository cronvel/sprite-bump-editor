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


function ImageManipulator( object , width , height , channels = RGBA , data = null ) {
	var i , channel ;

	this.object = object || null ;
	this.width = width || this.object?.width || 1 ;
	this.height = height || this.object?.height || 1 ;

	this.offsetToChannel =
		Array.isArray( channels ) ? channels :
		typeof channels === 'number' ? PER_CHANNEL_COUNT[ channels ] || RGBA :
		RGBA ;
	this.isRGBA = ImageManipulator.areSameChannels( this.offsetToChannel , RGBA ) ;	// Speed up detection of ImageData compatibility
	this.channels = this.offsetToChannel.length ;	// To speed up computation
	this.alphaOffset = -1 ;		// To speed up computation
	this.hasChannel = {} ;
	this.channelToOffset = {} ;

	for ( i = 0 ; i < this.offsetToChannel.length ; i ++ ) {
		channel = this.offsetToChannel[ i ] ;
		if ( channel === 'alpha' ) { this.alphaOffset = i ; }
		this.hasChannel[ channel ] = true ;
		this.channelToOffset[ channel ] = i ;
	}

	this.data = data || this.object?.data || new Uint8ClampedArray( this.width * this.height * this.channels ) ;

	if ( this.isRGBA ) {
		this.setPixel = this.setPixelRgba ;
		this.setPixelIfGreaterAlpha = this.setPixelRgbaIfGreaterAlpha ;
		this.intensityAtOffset = this.rgbIntensityAtOffset ;
	}

	if ( ! this.hasChannel.alpha ) {
		this.setPixelIfGreaterAlpha = this.setPixel ;
	}
}

module.exports = ImageManipulator ;



const MONO = [ 'mono' ] ;
const MONO_A = [ 'mono' , 'alpha' ] ;
const A = [ 'alpha' ] ;
const RG = [ 'red' , 'green' ] ;	// Useful for normals, the blue channel can be reconstructed from red and green
const RGB = [ 'red' , 'green' , 'blue' ] ;
const RGBA = [ 'red' , 'green' , 'blue' , 'alpha' ] ;
const PER_CHANNEL_COUNT = [ null , MONO , RG , RGB , RGBA ] ;

ImageManipulator.channels = {
	MONO , MONO_A , A , RG , RGB , RGBA
} ;

const TRANSFORM = {
	identity: x => x ,
	circular: x => Math.sqrt( 2 * x - x * x )	// Circle formula reversed from sqrt( 1 - x² ), with x -> 1 - x
} ;

// Aliases
TRANSFORM.linear = TRANSFORM.identity ;
TRANSFORM.round = TRANSFORM.circular ;



const REUSABLE_RGB = { r: 0 , g: 0 , b: 0 } ;
const REUSABLE_NORMAL = { x: 0 , y: 0 , z: 0 } ;



// Create a new ImageManipulator from an imageData, supporting using custom channels
ImageManipulator.fromImageData = function( imageData , channels = RGBA ) {
	var rgba = new ImageManipulator( imageData ) ;
	if ( ImageManipulator.areSameChannels( channels , RGBA ) ) { return rgba ; }

	var imageManipulator = new ImageManipulator( null , imageData.width , imageData.height , channels ) ;
	rgba.copyTo( imageManipulator ) ;
	return imageManipulator ;
} ;

ImageManipulator.prototype.clone = function() {
	var imageManipulator = new ImageManipulator( null , this.width , this.height , this.offsetToChannel ) ;
	imageManipulator.data.set( this.data ) ;
	return imageManipulator ;
} ;

ImageManipulator.prototype.cloneData = function() { return new Uint8ClampedArray( this.data ) ; } ;
ImageManipulator.prototype.setData = function( data ) { this.data.set( data ) ; } ;
ImageManipulator.prototype.getOffset = function( x , y ) { return this.channels * ( y * this.width + x ) ; } ;
ImageManipulator.prototype.getChannel = function( x , y , c ) { return this.data[ this.channels * ( y * this.width + x ) + c ] ; } ;
ImageManipulator.prototype.getAlpha = function( x , y ) { return this.data[ this.channels * ( y * this.width + x ) + this.alphaOffset ] ; } ;
ImageManipulator.prototype.getNormalizedAlpha = function( x , y ) { return this.data[ this.channels * ( y * this.width + x ) + this.alphaOffset ] / 255 ; } ;

ImageManipulator.areSameChannels = function( a , b ) {
	if ( a === b ) { return true ; }
	if ( a.length !== b.length ) { return false ; }
	for ( let c = 0 ; c < a.length ; c ++ ) {
		if ( a[ c ] !== b[ c ] ) { return false ; }
	}
	return true ;
} ;

ImageManipulator.prototype.hasSameChannels = function( to ) {
	return ImageManipulator.areSameChannels( this.offsetToChannel , to.offsetToChannel ) ;
} ;



ImageManipulator.prototype.clear = function() {
	for ( let c = 0 , cMax = this.data.length ; c < cMax ; c ++ ) { this.data[ c ] = 0 ; }
} ;

ImageManipulator.prototype.clearWhite = function() {
	for ( let c = 0 , cMax = this.data.length ; c < cMax ; c ++ ) { this.data[ c ] = 255 ; }
} ;

ImageManipulator.prototype.clearOpaqueBlack = function() {
	if ( ! this.hasChannel.alpha ) { return this.clear() ; }

	var offset , c ,
		offsetMax = this.width * this.height * this.channels ;

	for ( offset = 0 ; offset < offsetMax ; offset += this.channels ) {
		for ( c = 0 ; c < this.channels ; c ++ ) {
			this.data[ offset + c ] = c === this.alphaOffset ? 255 : 0 ;
		}
	}
} ;

ImageManipulator.prototype.clearNormal = function() {
	var offset , c ,
		offsetMax = this.width * this.height * this.channels ;

	for ( offset = 0 ; offset < offsetMax ; offset += this.channels ) {
		for ( c = 0 ; c < this.channels ; c ++ ) {
			this.data[ offset + c ] =
				c === this.channelToOffset.red ? 128 :
				c === this.channelToOffset.green ? 128 :
				c === this.channelToOffset.blue ? 255 :
				c === this.alphaOffset ? 255 :
				0 ;
		}
	}
} ;

ImageManipulator.prototype.rgbIntensityAtOffset = function( offset ) {
	return ( this.data[ offset ] + this.data[ offset + 1 ] + this.data[ offset + 2 ] ) / 765 ;	// = avg(r,g,b)/255
} ;

ImageManipulator.prototype.intensityAtOffset = function( offset ) {
	var c , sum = 0 ;
	for ( c = 0 ; c < this.channels ; c ++ ) {
		if ( c !== this.alphaOffset ) { sum += this.data[ offset + c ] ; }
	}
	return sum / ( this.channels * 255 ) ;
} ;

ImageManipulator.prototype.averageValueAtOffset = function( offset ) {
	var c , sum = 0 , count = 0 ;
	for ( c = 0 ; c < this.channels ; c ++ ) {
		if ( c !== this.alphaOffset ) {
			sum += this.data[ offset + c ] ;
			count ++ ;
		}
	}
	return Math.round( sum / count ) ;
} ;

ImageManipulator.prototype.setMonoAtOffset = function( offset , value ) {
	for ( let c = 0 ; c < this.channels ; c ++ ) {
		if ( c !== this.alphaOffset ) { this.data[ offset + c ] = value ; }
	}
} ;



ImageManipulator.prototype.getClampedOffset = function( x , y ) {
	if ( x < 0 ) { x = 0 ; }
	else if ( x >= this.width ) { x = this.width - 1 ; }

	if ( y < 0 ) { y = 0 ; }
	else if ( y >= this.height ) { y = this.height - 1 ; }

	return this.channels * ( y * this.width + x ) ;
} ;



ImageManipulator.prototype.getPixelObject = function( x , y , pixel = {} ) {
	var offset = this.channels * ( y * this.width + x ) ;

	for ( let c = 0 ; c < this.channels ; c ++ ) {
		pixel[ this.offsetToChannel[ c ] ] = this.data[ offset + c ] ;
	}

	return pixel ;
} ;



ImageManipulator.prototype.setPixel = function( x , y , values ) {
	var offset = this.channels * ( y * this.width + x ) ;
	for ( let c = 0 ; c < this.channels ; c ++ ) { this.data[ offset + c ] = values[ c ] ; }
} ;



ImageManipulator.prototype.setPixelRgba = function( x , y , values ) {
	var offset = this.channels * ( y * this.width + x ) ;
	this.data[ offset ] = values[ 0 ] ;
	this.data[ offset + 1 ] = values[ 1 ] ;
	this.data[ offset + 2 ] = values[ 2 ] ;
	this.data[ offset + 3 ] = values[ 3 ] ;
} ;



ImageManipulator.prototype.setPixelIfGreaterAlpha = function( x , y , values ) {
	var offset = this.channels * ( y * this.width + x ) ;
	if ( this.data[ offset + this.alphaOffset ] >= values[ this.alphaOffset ] ) { return ; }
	for ( let c = 0 ; c < this.channels ; c ++ ) { this.data[ offset + c ] = values[ c ] ; }
} ;



ImageManipulator.prototype.setPixelRgbaIfGreaterAlpha = function( x , y , values ) {
	var offset = this.channels * ( y * this.width + x ) ;
	if ( this.data[ offset + 3 ] >= values[ 3 ] ) { return ; }
	this.data[ offset ] = values[ 0 ] ;
	this.data[ offset + 1 ] = values[ 1 ] ;
	this.data[ offset + 2 ] = values[ 2 ] ;
	this.data[ offset + 3 ] = values[ 3 ] ;
} ;



const CHANNEL_LETTER = {
	r: 'red' ,
	g: 'green' ,
	b: 'blue' ,
	a: 'alpha' ,
	m: 'mono'
} ;

ImageManipulator.prototype.letterToChannel = function( object ) {
	var key , newKey , out = {} ;

	for ( key in object ) {
		newKey = CHANNEL_LETTER[ key ] || key ;
		out[ newKey ] = object[ key ] ;
	}

	return out ;
} ;



// Internal, return an array of boolean
ImageManipulator.prototype.channelIndexes = function( channels_ ) {
	var i , c ,
		channels = new Array( this.channels ) ;

	if ( Array.isArray( channels_ ) ) {
		// Default to no channel
		channels.fill( false ) ;
		for ( i = 0 ; i < channels_.length ; i ++ ) {
			c = channels_[ i ] ;
			if ( typeof c === 'number' ) { channels[ c ] = true ; }
			else if ( typeof c === 'string' ) { channels[ this.channelToOffset[ c ] ] = true ; }
			else { channels[ i ] = !! c ; }
		}
	}
	else {
		// Default to all channels
		channels.fill( true ) ;
	}

	return channels ;
} ;



ImageManipulator.prototype.fillChannel = function( channel , value ) {
	if ( ! this.hasChannel[ channel ] ) { return ; }

	var offset , c ,
		offsetMax = this.width * this.height * this.channels ,
		channelOffset = this.channelToOffset[ channel ] ;

	for ( offset = 0 ; offset < offsetMax ; offset += this.channels ) {
		this.data[ offset + channelOffset ] = value ;
	}
} ;



ImageManipulator.prototype.disc = function( cx , cy , hardRadius , softRadius , color , mask = null , effectParams = null ) {
	var x , y , c , dx , dy , d , hardness , invHardness , alpha , offset ,
		useAlpha = !! this.hasChannel.alpha ,
		alphaBase = color.a !== undefined ? color.a : 255 ,
		colorArray = new Array( this.channels ).fill( 0 ) ,
		effectFn = effectParams?.fn ,
		effectColorArray = effectFn ? new Array( this.channels ).fill( 0 ) : null ,
		xMin = Math.max( 0 , Math.floor( cx - softRadius ) ) ,
		xMax = Math.min( this.width - 1 , Math.ceil( cx + softRadius ) ) ,
		yMin = Math.max( 0 , Math.floor( cy - softRadius ) ) ,
		yMax = Math.min( this.height - 1 , Math.ceil( cy + softRadius ) ) ;
	//console.warn( ".disc()" , cx , cy , hardRadius , softRadius , color , xMin , xMax , yMin , yMax ) ;

	if ( this.hasChannel.mono ) { colorArray[ this.channelToOffset.mono ] = Math.round( ( color.r + color.g + color.b ) / 3 ) ; }
	if ( this.hasChannel.red ) { colorArray[ this.channelToOffset.red ] = color.r ; }
	if ( this.hasChannel.green ) { colorArray[ this.channelToOffset.green ] = color.g ; }
	if ( this.hasChannel.blue ) { colorArray[ this.channelToOffset.blue ] = color.b ; }
	if ( useAlpha ) { colorArray[ this.alphaOffset ] = alphaBase ; }

	for ( y = yMin ; y <= yMax ; y ++ ) {
		dy = y - cy ;

		for ( x = xMin ; x <= xMax ; x ++ ) {
			dx = x - cx ;
			d = Math.sqrt( dx * dx + dy * dy ) ;
			if ( d >= softRadius ) { continue ; }

			offset = this.getOffset( x , y ) ;

			if ( useAlpha ) {
				hardness = this.hardness( d , hardRadius , softRadius ) ;
				if ( mask ) { hardness *= mask.getNormalizedAlpha( x , y ) ; }
				alpha = Math.round( alphaBase * hardness ) ;
				if ( alpha <= this.data[ offset + this.alphaOffset ] ) { continue ; }
				colorArray[ this.alphaOffset ] = alpha ;
			}
			else {
				hardness = 1 ;
			}

			invHardness = 1 - hardness ;

			if ( effectFn ) {
				effectFn.call( this , effectColorArray , offset , colorArray , x , y , mask , effectParams ) ;
				for ( c = 0 ; c < this.channels ; c ++ ) {
					if ( c === this.alphaOffset ) { this.data[ offset + c ] = colorArray[ c ] ; }
					else { this.data[ offset + c ] = effectColorArray[ c ] ; }
				}
			}
			else {
				for ( c = 0 ; c < this.channels ; c ++ ) { this.data[ offset + c ] = colorArray[ c ] ; }
			}
		}
	}
} ;



ImageManipulator.prototype.thickLine = function( fromX , fromY , toX , toY , hardRadius , softRadius , color , mask = null , effectParams = null ) {
	if ( fromX === toX && fromY === toY ) {
		return this.disc( fromX , fromY , hardRadius , softRadius , color , mask , effectParams ) ;
	}

	var x , y , c , dx , dy , d , segmentProjection , hardness , invHardness , alpha , offset ,
		useAlpha = !! this.hasChannel.alpha ,
		alphaBase = color.a !== undefined ? color.a : 255 ,
		colorArray = new Array( this.channels ).fill( 0 ) ,
		effectFn = effectParams?.fn ,
		effectColorArray = effectFn ? new Array( this.channels ).fill( 0 ) : null ,
		segment = new Segment( fromX , fromY , toX , toY ) ,
		xMin = Math.max( 0 , Math.floor( Math.min( fromX , toX ) - softRadius ) ) ,
		xMax = Math.min( this.width - 1 , Math.ceil( Math.max( fromX , toX ) + softRadius ) ) ,
		yMin = Math.max( 0 , Math.floor( Math.min( fromY , toY ) - softRadius ) ) ,
		yMax = Math.min( this.height - 1 , Math.ceil( Math.max( fromY , toY ) + softRadius ) ) ;

	if ( this.hasChannel.mono ) { colorArray[ this.channelToOffset.mono ] = Math.round( ( color.r + color.g + color.b ) / 3 ) ; }
	if ( this.hasChannel.red ) { colorArray[ this.channelToOffset.red ] = color.r ; }
	if ( this.hasChannel.green ) { colorArray[ this.channelToOffset.green ] = color.g ; }
	if ( this.hasChannel.blue ) { colorArray[ this.channelToOffset.blue ] = color.b ; }
	if ( useAlpha ) { colorArray[ this.alphaOffset ] = alphaBase ; }

	for ( y = yMin ; y <= yMax ; y ++ ) {
		for ( x = xMin ; x <= xMax ; x ++ ) {
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
				if ( d >= softRadius ) { continue ; }

				offset = this.getOffset( x , y ) ;

				if ( useAlpha ) {
					hardness = this.hardness( d , hardRadius , softRadius ) ;
					if ( mask ) { hardness *= mask.getNormalizedAlpha( x , y ) ; }
					alpha = Math.round( alphaBase * hardness ) ;
					if ( alpha <= this.data[ offset + this.alphaOffset ] ) { continue ; }
					colorArray[ this.alphaOffset ] = alpha ;
				}
				else {
					hardness = 1 ;
				}

				invHardness = 1 - hardness ;

				if ( effectFn ) {
					effectFn.call( this , effectColorArray , offset , colorArray , x , y , mask , effectParams ) ;
					for ( c = 0 ; c < this.channels ; c ++ ) {
						if ( c === this.alphaOffset ) { this.data[ offset + c ] = colorArray[ c ] ; }
						else { this.data[ offset + c ] = effectColorArray[ c ] ; }
					}
				}
				else {
					for ( c = 0 ; c < this.channels ; c ++ ) { this.data[ offset + c ] = colorArray[ c ] ; }
				}

				continue ;
			}

			d = segment.lineDistance( x , y ) ;
			if ( d >= softRadius ) { continue ; }

			offset = this.getOffset( x , y ) ;

			if ( useAlpha ) {
				hardness = this.hardness( d , hardRadius , softRadius ) ;
				if ( mask ) { hardness *= mask.getNormalizedAlpha( x , y ) ; }
				alpha = Math.round( alphaBase * hardness ) ;
				if ( alpha <= this.data[ offset + this.alphaOffset ] ) { continue ; }
				colorArray[ this.alphaOffset ] = alpha ;
			}
			else {
				hardness = 1 ;
			}

			invHardness = 1 - hardness ;

			if ( effectFn ) {
				effectFn.call( this , effectColorArray , offset , colorArray , x , y , mask , effectParams ) ;
				for ( c = 0 ; c < this.channels ; c ++ ) {
					if ( c === this.alphaOffset ) { this.data[ offset + c ] = colorArray[ c ] ; }
					else { this.data[ offset + c ] = effectColorArray[ c ] ; }
				}
			}
			else {
				for ( c = 0 ; c < this.channels ; c ++ ) { this.data[ offset + c ] = colorArray[ c ] ; }
			}
		}
	}
} ;



// Internal: decay for a brush softness
ImageManipulator.prototype.hardness = function( distance , hard , soft ) {
	if ( distance <= hard ) { return 1 ; }

	// Linear
	var hardness = ( soft - distance ) / ( soft - hard ) ;

	// Sine falloff, seems to be the best falloff so far
	hardness = ( 1 - Math.cos( hardness * Math.PI ) ) / 2 ;

	// Square root falloff (too much hardness on the edge)
	//hardness = Math.sqrt( hardness ) ;

	// Circle falloff (way too much hardness on the edge)
	//hardness = Math.sqrt( 1 - hardness * hardness ) ;

	return hardness ;
} ;



ImageManipulator.prototype.blurEffect = function( output , offset , color , x , y , mask , params ) {
	for ( let c = 0 ; c < this.channels ; c ++ ) {
		if ( c !== this.alphaOffset ) {
			// For instance we ignore alpha, since we can't draw alpha ATM (alpha is used for hardness falloff, as a merge factor, not as value)
			output[ c ] = params.source.blurChannelValueAt( c , x , y , params ) ;
		}
	}
} ;



// In-place
// Stripe channels by inverting them if the conditionChannel is positive
ImageManipulator.prototype.stripe = function( area , conditionChannel , stripeChannels , width = 8 ) {
	var x , y , offset , c , cOffset , value ,
		conditionOffset = this.channelToOffset[ conditionChannel ] ,
		stripeOffsets = stripeChannels.map( channel => this.channelToOffset[ channel ] ) ;

	if ( ! area ) {
		area = {
			xMin: 0 , xMax: this.width - 1 , yMin: 0 , yMax: this.height - 1
		} ;
	}
	else {
		if ( area.xMin === undefined ) { area.xMin = 0 ; }
		if ( area.xMax === undefined ) { area.xMax = this.width - 1 ; }
		if ( area.yMin === undefined ) { area.yMin = 0 ; }
		if ( area.yMax === undefined ) { area.yMax = this.height - 1 ; }
	}

	for ( y = area.yMin ; y <= area.yMax ; y ++ ) {
		for ( x = area.xMin ; x <= area.xMax ; x ++ ) {
			offset = this.getOffset( x , y ) ;

			if (
				! this.data[ offset + conditionOffset ]
				|| ( area.mask && ! area.mask.getAlpha( x , y ) )
				|| Math.floor( ( x + y ) / width ) % 2
			) {
				continue ;
			}

			// Invert!
			for ( c = 0 ; c < stripeOffsets.length ; c ++ ) {
				cOffset = offset + stripeOffsets[ c ] ;
				this.data[ cOffset ] = 255 - this.data[ cOffset ] ;
			}
		}
	}
} ;



// In-place
// KeepXY: try to only adapt Z (blue channel) if possible
// It requires RGB channels.
ImageManipulator.prototype.normalizeNormals = function( keepXY = false ) {
	var offset , maxOffset ,
		toNormal = keepXY ? helpers.rgToNormal : helpers.rgbToNormal ,
		rgb = REUSABLE_RGB ,
		normal = REUSABLE_NORMAL ,
		offsetR = this.channelToOffset.red ,
		offsetG = this.channelToOffset.green ,
		offsetB = this.channelToOffset.blue ;

	for ( offset = 0 , maxOffset = this.data.length ; offset < maxOffset ; offset += this.channels ) {
		rgb.r = this.data[ offset + offsetR ] ;
		rgb.g = this.data[ offset + offsetG ] ;
		rgb.b = this.data[ offset + offsetB ] ;
		toNormal( rgb , normal ) ;
		helpers.normalToRgb( normal , rgb ) ;
		this.data[ offset + offsetR ] = rgb.r ;
		this.data[ offset + offsetG ] = rgb.g ;
		this.data[ offset + offsetB ] = rgb.b ;
	}
} ;



function Scanline( xMin , xMax , y , upward , downward , leftward , rightward ) {
	this.xMin = xMin ;
	this.xMax = xMax ;
	this.y = y ;
	this.upward = !! upward ;
	this.downward = !! downward ;
	this.leftward = !! leftward ;
	this.rightward = !! rightward ;
}



ImageManipulator.prototype.magicSelect = function( to , area , oX , oY , fn , params = {} ) {
	var i , iMax , x , offset , toOffset , mapOffset , oOffset , oValues , maskAlpha  ,
		startX , lastValidX , lastFailed , hasFailed , first , up , down , tmp ,
		scanlines , nextScanlines , scanline ,
		channelOffsets = params.channels ? params.channels.filter( name => this.hasChannel[ name ] ).map( name => this.channelToOffset[ name ] ) : [ 0 ] ,
		tolerance = ( + params.tolerance || 0 ) * 255 ,
		tolerance2 = tolerance * tolerance ;

	// Could be useful for fn()
	params.selectionChannelOffsets = channelOffsets ;

	// Store where we have succeeded so far
	var map = new ImageManipulator( null , this.width , this.height , A ) ;

	if ( ! to ) { to = new ImageManipulator( null , this.width , this.height , MONO_A ) ; }
	else if ( ! ( to instanceof ImageManipulator ) ) { to = new ImageManipulator( to ) ; }

	if ( ! area ) {
		area = {
			xMin: 0 , xMax: this.width - 1 , yMin: 0 , yMax: this.height - 1
		} ;
	}
	else {
		if ( area.xMin === undefined ) { area.xMin = 0 ; }
		if ( area.xMax === undefined ) { area.xMax = this.width - 1 ; }
		if ( area.yMin === undefined ) { area.yMin = 0 ; }
		if ( area.yMax === undefined ) { area.yMax = this.height - 1 ; }
	}

	oX = Math.round( oX ) ;
	oY = Math.round( oY ) ;

	oOffset = this.getOffset( oX , oY ) ;

	// Colors to find
	oValues = channelOffsets.map( channelOffset => this.data[ oOffset + channelOffset ] ) ;

	scanlines = [ new Scanline( oX , oX , oY , true , true ) ] ;
	nextScanlines = [] ;

	var check = ( x_ , y_ ) =>
		// Check if already marked
		! map.data[ mapOffset ]
		// Check color-space distance
		&& channelOffsets.reduce( ( sum , c ) => {
			var v = this.data[ offset + c ] - oValues[ c ] ;
			return sum + v * v ;
		} , 0 ) <= tolerance2
		&& ( ! area.mask || area.mask.getAlpha( x_ , y_ ) ) ;


	var mark = ( x_ , y_ ) => {
		map.data[ mapOffset ] = 255 ;

		if ( area.mask ) {
			maskAlpha = area.mask.getNormalizedAlpha( x_ , y_ ) ;
			if ( maskAlpha ) {
				fn( this , offset , to , to.getOffset( x_ , y_ ) , area.mask , maskAlpha , x_ , y_ , params ) ;
			}
		}
		else {
			fn( this , offset , to , to.getOffset( x_ , y_ ) , null , 0 , x_ , y_ , params ) ;
		}
	} ;


	while ( scanlines.length ) {

		// Phase 1: check current lines, mark destination, split on already marked pixel and not matching pixel

		for ( scanline of scanlines ) {
			first = true ;
			hasFailed = lastFailed = false ;

			for ( x = scanline.xMin ; x <= scanline.xMax ; x ++ ) {
				offset = this.getOffset( x , scanline.y ) ;
				mapOffset = map.getOffset( x , scanline.y ) ;

				if ( check( x , scanline.y ) ) {
					if ( lastFailed || first ) { startX = x ; }
					lastFailed = false ;
					mark( x , scanline.y ) ;
				}
				else {
					if ( lastFailed ) { continue ; }
					lastFailed = hasFailed = true ;
					if ( ! first ) {
						nextScanlines.push( new Scanline( startX , x - 1 , scanline.y , scanline.upward , scanline.downward , true , false ) ) ;
					}
				}

				first = false ;
			}

			if ( ! hasFailed ) {
				// The whole line matched, re-use current scanline for next gen
				scanline.leftward = scanline.rightward = true ;
				nextScanlines.push( scanline ) ;
			}
			else if ( ! lastFailed ) {
				// Remainder
				nextScanlines.push( new Scanline( startX , scanline.xMax , scanline.y , scanline.upward , scanline.downward , false , true ) ) ;
			}
		}

		// Swap and reset nextScanlines
		tmp = scanlines ; scanlines = nextScanlines ; nextScanlines = tmp ; nextScanlines.length = 0 ;
		//console.warn( "checkpoint A" , scanlines.length , scanlines.map( e => Object.assign( {} ,e ) ) ) ;


		// Phase 2: enlarge lines

		for ( i = 0 , iMax = scanlines.length ; i < iMax ; i ++ ) {
			scanline = scanlines[ i ] ;
			hasFailed = false ;

			// Search on the left
			if ( scanline.leftward ) {
				lastValidX = scanline.xMin ;
				for ( x = scanline.xMin - 1 ; x >= area.xMin ; x -- ) {
					offset = this.getOffset( x , scanline.y ) ;
					mapOffset = map.getOffset( x , scanline.y ) ;

					if ( ! check( x , scanline.y ) ) { break ; }

					// Mark current pixel
					mark( x , scanline.y ) ;
					lastValidX = x ;
				}

				if ( lastValidX !== scanline.xMin ) {
					// Create scanline in missing direction
					if ( ! scanline.upward ) {
						scanlines.push( new Scanline( lastValidX , scanline.xMin - 1 , scanline.y , true , false ) ) ;
					}
					if ( ! scanline.downward ) {
						scanlines.push( new Scanline( lastValidX , scanline.xMin - 1 , scanline.y , false , true ) ) ;
					}
					// Extend current scanline
					scanline.xMin = lastValidX ;
				}
			}

			// Search on the right
			if ( scanline.rightward ) {
				lastValidX = scanline.xMax ;
				for ( x = scanline.xMax + 1 ; x <= area.xMax ; x ++ ) {
					offset = this.getOffset( x , scanline.y ) ;
					mapOffset = map.getOffset( x , scanline.y ) ;

					if ( ! check( x , scanline.y ) ) { break ; }

					// Mark current pixel
					mark( x , scanline.y ) ;
					lastValidX = x ;
				}

				if ( lastValidX !== scanline.xMax ) {
					// Create scanline in missing direction
					if ( ! scanline.upward ) {
						scanlines.push( new Scanline( scanline.xMax + 1 , lastValidX , scanline.y , true , false ) ) ;
					}
					if ( ! scanline.downward ) {
						scanlines.push( new Scanline( scanline.xMax + 1 , lastValidX , scanline.y , false , true ) ) ;
					}
					// Extend current scanline
					scanline.xMax = lastValidX ;
				}
			}
		}
		//console.warn( "checkpoint B" , scanlines.length , scanlines.map( e => Object.assign( {} ,e ) ) ) ;


		// Phase 3: move/propagate upward/downward

		for ( i = 0 , iMax = scanlines.length ; i < iMax ; i ++ ) {
			scanline = scanlines[ i ] ;
			up = scanline.upward && scanline.y - 1 >= area.yMin ;
			down = scanline.downward && scanline.y + 1 <= area.yMax ;

			if ( up && down ) {
				// Create the down line
				nextScanlines.push( new Scanline( scanline.xMin , scanline.xMax , scanline.y + 1 , false , true ) ) ;
				// Re-use the current scanline for the up line
				scanline.y -- ;
				scanline.downward = false ;
				nextScanlines.push( scanline ) ;
			}
			else if ( up ) {
				scanline.y -- ;
				scanline.downward = false ;
				nextScanlines.push( scanline ) ;
			}
			else if ( down ) {
				scanline.y ++ ;
				scanline.upward = false ;
				nextScanlines.push( scanline ) ;
			}
		}

		// Swap and reset nextScanlines
		tmp = scanlines ; scanlines = nextScanlines ; nextScanlines = tmp ; nextScanlines.length = 0 ;
		//console.warn( "checkpoint C" , scanlines.length , scanlines.map( e => Object.assign( {} ,e ) ) ) ;
	}

	return to ;
} ;

ImageManipulator.alphaSelectOffset = function( from , offset , to , toOffset , mask , maskAlpha , x , y , params ) {
	to.data[ toOffset + to.alphaOffset ] = 255 ;
} ;

ImageManipulator.monoAlphaSelectOffset = function( from , offset , to , toOffset , mask , maskAlpha , x , y , params ) {
	to.data[ toOffset + to.alphaOffset ] = 255 ;
	to.data[ toOffset + to.channelToOffset.mono ] = 255 ;
} ;



ImageManipulator.prototype.fill = function( area , x , y , color , tolerance = 0.1 ) {
	var channels , colorArray ;

	color = this.letterToChannel( color ) ;
	channels = Object.keys( color ).filter( name => this.hasChannel[ name ] ) ;
	colorArray = channels.map( name => color[ name ] ) ;

	if ( this.hasChannel.mono && color.mono === undefined && color.red !== undefined && color.green !== undefined && color.blue !== undefined ) {
		channels.push( 'mono' ) ;
		colorArray[ channels.length - 1 ] = Math.round( ( color.red + color.green + color.blue ) / 3 ) ;
	}

	//console.warn( "fill:" , color , channels , colorArray ) ;

	return this.magicSelect(
		this ,
		area ,
		x ,
		y ,
		ImageManipulator.fillOffset ,
		{ channels , colorArray , tolerance }
	) ;
} ;

ImageManipulator.fillOffset = function( from , offset , to , toOffset , mask , maskAlpha , x , y , params ) {
	var invAlpha , c , cOffset ,
		cMax = params.selectionChannelOffsets.length ;

	if ( mask && maskAlpha < 1 ) {
		invAlpha = 1 - maskAlpha ;

		for ( c = 0 ; c < cMax ; c ++ ) {
			cOffset = params.selectionChannelOffsets[ c ] ;
			to.data[ toOffset + cOffset ] = maskAlpha * params.colorArray[ cOffset ] + invAlpha * to.data[ toOffset + cOffset ] ;
		}
	}
	else {

		for ( c = 0 ; c < cMax ; c ++ ) {
			cOffset = params.selectionChannelOffsets[ c ] ;
			to.data[ toOffset + cOffset ] = params.colorArray[ cOffset ] ;
		}
	}
} ;



// Internal
ImageManipulator.prototype.combine = function( to , area , combineFn , sameChannelCombineFn = null , params = {} ) {
	var fn , x , y , maskAlpha ;

	if ( ! to ) { to = new ImageManipulator( null , this.width , this.height , this.offsetToChannel ) ; }
	else if ( ! ( to instanceof ImageManipulator ) ) { to = new ImageManipulator( to ) ; }

	if ( ! area ) {
		area = {
			xMin: 0 , xMax: this.width - 1 , yMin: 0 , yMax: this.height - 1
		} ;
	}
	else {
		if ( area.xMin === undefined ) { area.xMin = 0 ; }
		if ( area.xMax === undefined ) { area.xMax = this.width - 1 ; }
		if ( area.yMin === undefined ) { area.yMin = 0 ; }
		if ( area.yMax === undefined ) { area.yMax = this.height - 1 ; }
	}

	fn = ! sameChannelCombineFn || ! this.hasSameChannels( to ) ? combineFn : sameChannelCombineFn ;

	if ( ! fn ) {
		throw new Error( ".combine(): destination doesn't have the same channels: " + this.offsetToChannel.join( '|' ) + ' and ' + to.offsetToChannel.join( '|' ) ) ;
	}

	if ( area.mask ) {
		// Need an alpha-scan to reduce the area to the non-zero part

		for ( y = area.yMin ; y <= area.yMax ; y ++ ) {
			for ( x = area.xMin ; x <= area.xMax ; x ++ ) {
				maskAlpha = area.mask.getNormalizedAlpha( x , y ) ;
				if ( maskAlpha ) {
					fn( this , this.getOffset( x , y ) , to , to.getOffset( x , y ) , area.mask , maskAlpha , x , y , params ) ;
				}
			}
		}
	}
	else {
		for ( y = area.yMin ; y <= area.yMax ; y ++ ) {
			for ( x = area.xMin ; x <= area.xMax ; x ++ ) {
				fn( this , this.getOffset( x , y ) , to , to.getOffset( x , y ) , null , 0 , x , y , params ) ;
			}
		}
	}

	return to ;
} ;



ImageManipulator.prototype.copyTo = function( to , area ) {
	return this.combine( to , area , ImageManipulator.copyOffset , ImageManipulator.sameChannelsCopyOffset ) ;
} ;

ImageManipulator.copyOffset = function( from , offset , to , toOffset ) {
	var c , channel ;
	for ( c = 0 ; c < to.channels ; c ++ ) {
		channel = to.offsetToChannel[ c ] ;
		if ( from.hasChannel[ channel ] ) {
			to.data[ toOffset + c ] = from.data[ offset + from.channelToOffset[ channel ] ] ;
		}
	}
} ;

ImageManipulator.sameChannelsCopyOffset = function( from , offset , to , toOffset ) {
	for ( let c = 0 ; c < to.channels ; c ++ ) {
		to.data[ toOffset + c ] = from.data[ offset + c ] ;
	}
} ;



ImageManipulator.prototype.compatibleCopyTo = function( to , area ) {
	var fn = ImageManipulator.copyOffset ,
		params = {} ;

	if ( this.hasChannel.mono || to.hasChannel.mono ) {
		fn = ImageManipulator.compatibleCopyOffset ;
	}

	if ( to.hasChannel.alpha && ! this.hasChannel.alpha ) {
		fn = ImageManipulator.compatibleCopyOffset ;
	}

	return this.combine( to , area , fn , ImageManipulator.sameChannelsCopyOffset ) ;
} ;

ImageManipulator.compatibleCopyOffset = function( from , offset , to , toOffset , mask , maskAlpha , x , y , params ) {
	var c , channel ;

	for ( c = 0 ; c < to.channels ; c ++ ) {
		channel = to.offsetToChannel[ c ] ;
		if ( from.hasChannel[ channel ] ) {
			// Channel match!
			to.data[ toOffset + c ] = from.data[ offset + from.channelToOffset[ channel ] ] ;
		}
		else if ( c === to.alphaOffset ) {
			// Alpha channel, but no source alpha, make it opaque!
			to.data[ toOffset + c ] = 255 ;
		}
		else if ( from.hasChannel.mono ) {
			// No matching channel, but the source has a mono channel, use it!
			to.data[ toOffset + c ] = from.data[ offset + from.channelToOffset.mono ] ;
		}
		else if ( c === to.channelToOffset.mono ) {
			// This is a mono channel, but no mono channel on the source, we will simply use average source value to feed the mono channel...
			to.data[ toOffset + c ] = from.averageValueAtOffset( offset ) ;
		}
	}
} ;



ImageManipulator.prototype.copyChannelsTo = function( to , area , channels ) {
	return this.combine( to , area , ImageManipulator.copyChannelsOffset , null , { channels } ) ;
} ;

ImageManipulator.copyChannelsOffset = function( from , offset , to , toOffset , mask , maskAlpha , x , y , params ) {
	var c , channel ;
	for ( c = 0 ; c < params.channels.length ; c ++ ) {
		channel = params.channels[ c ] ;
		if ( from.hasChannel[ channel ] && to.hasChannel[ channel ] ) {
			to.data[ toOffset + to.channelToOffset[ channel ] ] = from.data[ offset + from.channelToOffset[ channel ] ] ;
		}
	}
} ;



ImageManipulator.prototype.copyChannelToChannel = function( to , area , fromChannel , toChannel ) {
	if ( ! to ) { to = this ; }
	if ( ! this.hasChannel[ fromChannel ] || ! to.hasChannel[ toChannel ] ) { return ; }

	fromChannel = this.channelToOffset[ fromChannel ] ;
	toChannel = to.channelToOffset[ toChannel ] ;

	return this.combine( to , area , ImageManipulator.copyChannelToChannelOffset , null , { fromChannel , toChannel } ) ;
} ;

ImageManipulator.copyChannelToChannelOffset = function( from , offset , to , toOffset , mask , maskAlpha , x , y , params ) {
	to.data[ toOffset + params.toChannel ] = from.data[ offset + params.fromChannel ] ;
} ;



ImageManipulator.prototype.toMono = function( to , area , toChannels = MONO ) {
	if ( ! to ) { to = new ImageManipulator( null , this.width , this.height , toChannels ) ; }
	else if ( ! ( to instanceof ImageManipulator ) ) { to = new ImageManipulator( to ) ; }

	return this.combine( to , area , ImageManipulator.toMonoOffset ) ;
} ;

ImageManipulator.toMonoOffset = function( from , offset , to , toOffset ) {
	var c ,
		value = from.averageValueAtOffset( offset ) ;

	for ( c = 0 ; c < to.channels ; c ++ ) {
		if ( c === to.alphaOffset ) {
			to.data[ toOffset + c ] = from.hasChannel.alpha ? from.data[ offset + from.alphaOffset ] : 255 ;
		}
		else {
			to.data[ toOffset + c ] = value ;
		}
	}
} ;



ImageManipulator.prototype.alphaToMono = function( to , area , toChannels = MONO ) {
	if ( ! to ) { to = new ImageManipulator( null , this.width , this.height , toChannels ) ; }
	else if ( ! ( to instanceof ImageManipulator ) ) { to = new ImageManipulator( to ) ; }
	if ( ! this.hasChannel.alpha ) { throw new Error( ".alphaToMono(): alpha channel is required" ) ; }

	return this.combine( to , area , ImageManipulator.alphaToMonoOffset ) ;
} ;

ImageManipulator.alphaToMonoOffset = function( from , offset , to , toOffset ) {
	for ( let c = 0 ; c < to.channels ; c ++ ) {
		to.data[ toOffset + c ] = c === to.alphaOffset ? 255 : from.data[ offset + from.alphaOffset ] ;
	}
} ;



ImageManipulator.prototype.mergeInto = function( to , area , forceOpaque = false ) {
	if ( ! this.hasChannel.alpha ) { throw new Error( ".mergeInto(): alpha channel is required" ) ; }
	//return this.combine( to , area , null , ImageManipulator.sameChannelsMergeOffset , { forceOpaque } ) ;
	//return this.combine( to , area , ImageManipulator.mergeOffset , null , { forceOpaque } ) ;
	return this.combine( to , area , ImageManipulator.mergeOffset , ImageManipulator.sameChannelsMergeOffset , { forceOpaque } ) ;
} ;

// Like .copyTo but alpha-aware (require alpha)
ImageManipulator.mergeOffset = function( from , offset , to , toOffset , mask , maskAlpha , x , y , params ) {
	var c , channel , fromA , fromInvA ;

	// Filter transparency out now
	fromA = from.data[ offset + from.alphaOffset ] / 255 ;
	if ( ! fromA ) { return ; }
	fromInvA = 1 - fromA ;

	for ( c = 0 ; c < to.channels ; c ++ ) {
		if ( c === to.alphaOffset ) {
			if ( params.forceOpaque ) {
				to.data[ toOffset + c ] = 255 ;
			}
			else if ( to.data[ toOffset + c ] < from.data[ offset + from.alphaOffset ] ) {
				to.data[ toOffset + c ] = from.data[ offset + from.alphaOffset ] ;
			}
		}
		else {
			channel = to.offsetToChannel[ c ] ;
			if ( from.hasChannel[ channel ] ) {
				to.data[ toOffset + c ] = Math.round( from.data[ offset + from.channelToOffset[ channel ] ] * fromA + to.data[ toOffset + c ] * fromInvA ) ;
			}
		}
	}
} ;

// Like .copyTo but alpha-aware (require alpha)
ImageManipulator.sameChannelsMergeOffset = function( from , offset , to , toOffset , mask , maskAlpha , x , y , params ) {
	var c , fromA , fromInvA ;

	// Filter transparency out now
	fromA = from.data[ offset + from.alphaOffset ] / 255 ;
	if ( ! fromA ) { return ; }
	fromInvA = 1 - fromA ;

	for ( c = 0 ; c < to.channels ; c ++ ) {
		if ( c === to.alphaOffset ) {
			if ( params.forceOpaque ) {
				to.data[ toOffset + c ] = 255 ;
			}
			else if ( to.data[ toOffset + c ] < from.data[ offset + c ] ) {
				to.data[ toOffset + c ] = from.data[ offset + c ] ;
			}
		}
		else {
			to.data[ toOffset + c ] = Math.round( from.data[ offset + c ] * fromA + to.data[ toOffset + c ] * fromInvA ) ;
		}
	}
} ;



ImageManipulator.prototype.mixInto = function( to , area , mix = 0.5 ) {
	return this.combine( to , area , ImageManipulator.mixOffset , ImageManipulator.sameChannelsMixOffset , { mix , invMix: 1 - mix } ) ;
} ;

ImageManipulator.mixOffset = function( from , offset , to , toOffset , mask , maskAlpha , x , y , params ) {
	var c , channel ;
	for ( c = 0 ; c < to.channels ; c ++ ) {
		channel = to.offsetToChannel[ c ] ;
		if ( from.hasChannel[ channel ] ) {
			to.data[ toOffset + c ] = Math.round(
				params.mix * from.data[ offset + from.channelToOffset[ channel ] ]
				+ params.invMix * to.data[ toOffset + c ]
			) ;
		}
	}
} ;

ImageManipulator.sameChannelsMixOffset = function( from , offset , to , toOffset , mask , maskAlpha , x , y , params ) {
	for ( let c = 0 ; c < to.channels ; c ++ ) {
		to.data[ toOffset + c ] = Math.round(
			params.mix * from.data[ offset + c ]
			+ params.invMix * to.data[ toOffset + c ]
		) ;
	}
} ;



ImageManipulator.prototype.heightToNormal = function( to , area , params = {} ) {
	if ( this.offsetToChannel[ 0 ] !== 'mono' ) {
		throw new Error( '.heightToNormal(): uncompatible channels' ) ;
	}

	if ( ! to ) { to = new ImageManipulator( null , this.width , this.height , RGB ) ; }
	else if ( ! ( to instanceof ImageManipulator ) ) { to = new ImageManipulator( to ) ; }

	if ( to.offsetToChannel[ 0 ] !== 'red' || to.offsetToChannel[ 1 ] !== 'green' || to.offsetToChannel[ 2 ] !== 'blue' ) {
		throw new Error( '.heightToNormal(): uncompatible destination channels' ) ;
	}

	return this.combine( to , area , ImageManipulator.heightToNormalOffset , null , {
		height: + params.height || 10
	} ) ;
} ;

// Constraint: I:mono O:rgb
ImageManipulator.heightToNormalOffset = function( from , offset , to , toOffset , mask , maskAlpha , x , y , params ) {
	var topLeft , top , topRight , left , right , bottomLeft , bottom , bottomRight ,
		normal = REUSABLE_NORMAL ,
		toRgb = REUSABLE_RGB ;

	// Filter transparency out now
	if ( from.hasChannel.alpha && ! from.data[ offset + from.alphaOffset ] ) {
		// Transparent area, set it to default normal
		to.data[ toOffset ] = 128 ;
		to.data[ toOffset + 1 ] = 128 ;
		to.data[ toOffset + 2 ] = 255 ;
		if ( to.hasChannel.alpha ) { to.data[ toOffset + to.alphaOffset ] = 255 ; }
		return ;
	}

	// Surrounding pixels
	topLeft = from.data[ from.getClampedOffset( x - 1 , y - 1 ) ] / 255 ;
	top = from.data[ from.getClampedOffset( x , y - 1 ) ] / 255 ;
	topRight = from.data[ from.getClampedOffset( x + 1 , y - 1 ) ] / 255 ;
	left = from.data[ from.getClampedOffset( x - 1 , y ) ] / 255 ;
	right = from.data[ from.getClampedOffset( x + 1 , y ) ] / 255 ;
	bottomLeft = from.data[ from.getClampedOffset( x - 1 , y + 1 ) ] / 255 ;
	bottom = from.data[ from.getClampedOffset( x , y + 1 ) ] / 255 ;
	bottomRight = from.data[ from.getClampedOffset( x + 1 , y + 1 ) ] / 255 ;

	// “Sobel” filter
	normal.x = ( topLeft + 2 * left + bottomLeft ) - ( topRight + 2 * right + bottomRight ) ;
	normal.y = ( bottomLeft + 2 * bottom + bottomRight ) - ( topLeft + 2 * top + topRight ) ;
	normal.z = 1 / params.height ;

	helpers.normalizeVector( normal ) ;
	helpers.normalToRgb( normal , toRgb ) ;

	to.data[ toOffset ] = toRgb.r ;
	to.data[ toOffset + 1 ] = toRgb.g ;
	to.data[ toOffset + 2 ] = toRgb.b ;
	if ( to.hasChannel.alpha ) { to.data[ toOffset + to.alphaOffset ] = 255 ; }
} ;



function normalizeMatrix( matrix ) {
	var factor = 1 / matrix.reduce( ( accumulator , v ) => accumulator + v , 0 ) ;
	if ( ! Number.isFinite( factor ) ) { return ; }
	return matrix.map( v => v * factor ) ;
}

const KERNEL_OPERATION_MATRIX = {
	identity: [ 0 , 0 , 0 , 0 , 1 , 0 , 0 , 0 , 0 ] ,
	edge0: [ 1 , 0 , -1 , 0 , 0 , 0 , -1 , 0 , 1 ] ,
	edge1: [ 0 , 1 , 0 , 1 , -4 , 1 , 0 , 1 , 0 ] ,
	edge2: [ -1 , -1 , -1 , -1 , 8 , -1 , -1 , -1 , -1 ] ,
	sharpen: [ 0 , -1 , 0 , -1 , 5 , -1 , 0 , -1 , 0 ] ,
	emboss: [ -2 , -1 , 0 , -1 , 1 , 1 , 0 , 1 , 2 ] ,
	boxBlur: normalizeMatrix( [ 1 , 1 , 1 , 1 , 1 , 1 , 1 , 1 , 1 ] ) ,
	gaussianBlur3x3: normalizeMatrix( [ 1 , 2 , 1 , 2 , 4 , 2 , 1 , 2 , 1 ] ) ,
	gaussianBlur5x5: normalizeMatrix( [ 1,4,6,4,1, 4,16,24,16,4, 6,24,36,24,6, 4,16,24,16,4, 1,4,6,4,1 ] ) ,
	unsharpMasking: normalizeMatrix( [ 1,4,6,4,1, 4,16,24,16,4, 6,24, -476 ,24,6, 4,16,24,16,4, 1,4,6,4,1 ] )
} ;

KERNEL_OPERATION_MATRIX.edge = KERNEL_OPERATION_MATRIX.edge2 ;
KERNEL_OPERATION_MATRIX.gaussian3x3 = KERNEL_OPERATION_MATRIX.gaussianBlur3x3 ;
KERNEL_OPERATION_MATRIX.gaussian5x5 = KERNEL_OPERATION_MATRIX.gaussianBlur5x5 ;

// channels: array of channel names/indexes to operate
ImageManipulator.prototype.kernel = function( to , area , params = {} ) {
	var matrix , matrixDelta ;

	if ( Array.isArray( params.matrix ) ) {
		matrix = params.normalizeMatrix ? normalizeMatrix( [ ... params.matrix ] ) : params.matrix ;
	}
	else {
		matrix = KERNEL_OPERATION_MATRIX[ params.operation ] || KERNEL_OPERATION_MATRIX.identity ;
	}

	matrixDelta = ( Math.sqrt( matrix.length ) - 1 ) / 2 ;
	if ( Math.round( matrixDelta ) !== matrixDelta ) { return ; }	// It should be a square matrix
	//console.warn( "kernel:" , { op: params.operation , kom: KERNEL_OPERATION_MATRIX[ params.operation ] , ops: KERNEL_OPERATION_MATRIX , matrix, matrixDelta, channels: this.channelIndexes( params.channels ) } ) ;

	return this.combine( to , area , ImageManipulator.kernelOffset , ImageManipulator.sameChannelsKernelOffset , {
		matrix ,
		matrixDelta ,
		outOfBoundIsBlack: !! params.outOfBoundIsBlack ,
		clamp: !! params.clamp ,
		alphaZero: !! params.alphaZero ,
		channels: this.channelIndexes( params.channels )
	} ) ;
} ;

ImageManipulator.kernelOffset = function( from , offset , to , toOffset , mask , maskAlpha , x , y , params ) {
	var c , channel ;

	// Filter transparency out now
	if ( ! params.alphaZero && from.hasChannel.alpha && ! from.data[ offset + from.alphaOffset ] ) { return ; }

	for ( c = 0 ; c < params.channels.length ; c ++ ) {
		channel = to.offsetToChannel[ c ] ;
		if ( from.hasChannel[ channel ] ) {
			to.data[ toOffset + to.channelToOffset[ channel ] ] =
				params.channels[ c ] ? from.kernelChannelValueAt( c , x , y , params ) :
				from.data[ offset + c ] ;
		}
	}
} ;

ImageManipulator.sameChannelsKernelOffset = function( from , offset , to , toOffset , mask , maskAlpha , x , y , params ) {
	// Filter transparency out now
	if ( ! params.alphaZero && from.hasChannel.alpha && ! from.data[ offset + from.alphaOffset ] ) { return ; }

	for ( let c = 0 ; c < params.channels.length ; c ++ ) {
		to.data[ toOffset + c ] =
			params.channels[ c ] ? from.kernelChannelValueAt( c , x , y , params ) :
			from.data[ offset + c ] ;
	}
} ;

// outOfBoundIsBlack: border pixels are zero (black)
// clamp: border pixels are replaced by the atX,atY pixel
// if both are false: border pixels are replaced by the atX,atY pixel
ImageManipulator.prototype.kernelChannelValueAt = function( channel , atX , atY , params ) {
	var x , y , offset ,
		localOffset = this.getClampedOffset( atX , atY ) ,
		value = 0 ,
		matrixIndex = 0 ,
		xMin = atX - params.matrixDelta ,
		xMax = atX + params.matrixDelta ,
		yMin = atY - params.matrixDelta ,
		yMax = atY + params.matrixDelta ;
	
	for ( y = yMin ; y <= yMax ; y ++ ) {
		for ( x = xMin ; x <= xMax ; x ++ , matrixIndex ++ ) {
			if ( x < 0 || y < 0 || x >= this.width || y >= this.height ) {
				if ( params.outOfBoundIsBlack ) { continue ; }	// = zero/black
				if ( params.clamp ) { offset = this.getClampedOffset( x , y ) ; }
				offset = localOffset ;
			}
			else {
				offset = this.getOffset( x , y ) ;
			}

			value += this.data[ offset + channel ] * params.matrix[ matrixIndex ] ;
		}
	}
	
	//value = Math.round( value ) ;
	value = Math.max( 0 , Math.min( 255 , Math.round( value ) ) ) ;
	
	return value ;
} ;



// channels: array of channel names/indexes to blur
ImageManipulator.prototype.blur = function( to , area , params = {} ) {
	return this.combine( to , area , null , ImageManipulator.blurOffset , {
		radius: + params.radius || 5 ,
		outOfBoundIsBlack: !! params.outOfBoundIsBlack ,
		erosion: !! params.erosion ,
		alphaZero: !! ( ! params.erosion && params.alphaZero ) ,
		channels: this.channelIndexes( params.channels )
	} ) ;
} ;

ImageManipulator.blurOffset = function( from , offset , to , toOffset , mask , maskAlpha , x , y , params ) {
	var c , fromValue , toValue ;

	// Filter transparency out now
	if ( ! params.alphaZero && from.hasChannel.alpha && ! from.data[ offset + from.alphaOffset ] ) { return ; }

	for ( c = 0 ; c < params.channels.length ; c ++ ) {
		fromValue = from.data[ offset + c ] ;

		if ( ! params.channels[ c ] ) {
			to.data[ toOffset + c ] = fromValue ;
		}
		else {
			toValue = from.blurChannelValueAt( c , x , y , params ) ;
			to.data[ toOffset + c ] = ! params.erosion || toValue < fromValue ? toValue : fromValue ;
		}
	}
} ;



// channels: array of channel names/indexes to blur
ImageManipulator.prototype.horizontalBlur = function( to , area , params = {} ) {
	return this.combine( to , area , null , ImageManipulator.horizontalBlurOffset , {
		radius: Math.ceil( + params.radius || 5 ) ,
		outOfBoundIsBlack: !! params.outOfBoundIsBlack ,
		erosion: !! params.erosion ,
		alphaZero: !! ( ! params.erosion && params.alphaZero ) ,
		channels: this.channelIndexes( params.channels )
	} ) ;
} ;

ImageManipulator.horizontalBlurOffset = function( from , offset , to , toOffset , mask , maskAlpha , x , y , params ) {
	// Filter transparency out now
	if ( ! params.alphaZero && from.hasChannel.alpha && ! from.data[ offset + from.alphaOffset ] ) { return ; }

	for ( let c = 0 ; c < params.channels.length ; c ++ ) {
		to.data[ toOffset + c ] = params.channels[ c ] ?
			from.horizontalBlurChannelValueAt( c , x , y , params ) :
			from.data[ offset + c ] ;
	}
} ;



// channels: array of channel names/indexes to blur
ImageManipulator.prototype.verticalBlur = function( to , area , params = {} ) {
	return this.combine( to , area , null , ImageManipulator.verticalBlurOffset , {
		radius: Math.ceil( + params.radius || 5 ) ,
		outOfBoundIsBlack: !! params.outOfBoundIsBlack ,
		erosion: !! params.erosion ,
		alphaZero: !! ( ! params.erosion && params.alphaZero ) ,
		channels: this.channelIndexes( params.channels )
	} ) ;
} ;

ImageManipulator.verticalBlurOffset = function( from , offset , to , toOffset , mask , maskAlpha , x , y , params ) {
	// Filter transparency out now
	if ( ! params.alphaZero && from.hasChannel.alpha && ! from.data[ offset + from.alphaOffset ] ) { return ; }

	for ( let c = 0 ; c < params.channels.length ; c ++ ) {
		to.data[ toOffset + c ] = params.channels[ c ] ?
			from.verticalBlurChannelValueAt( c , x , y , params ) :
			from.data[ offset + c ] ;
	}
} ;



// outOfBoundIsBlack: true=border are zero (black); false=border are replaced by the atX,atY pixel
ImageManipulator.prototype.blurChannelValueAt = function( channel , atX , atY , params ) {
	var x , y , dx , dy , d2 , offset ,
		localOffset = this.getClampedOffset( atX , atY ) ,
		sum = 0 ,
		count = 0 ,
		radius2 = params.radius * params.radius ,
		integerRadius = Math.ceil( params.radius ) ,
		xMin = atX - integerRadius ,
		xMax = atX + integerRadius ,
		yMin = atY - integerRadius ,
		yMax = atY + integerRadius ;

	for ( y = yMin ; y <= yMax ; y ++ ) {
		dy = y - atY ;

		for ( x = xMin ; x <= xMax ; x ++ ) {
			dx = x - atX ;
			d2 = dx * dx + dy * dy ;
			if ( d2 > radius2 ) { continue ; }
			count ++ ;

			if ( x < 0 || y < 0 || x >= this.width || y >= this.height ) {
				if ( params.outOfBoundIsBlack ) { continue ; }	// = zero/black
				//if ( params.clamp ) { offset = this.getClampedOffset( x , y ) ; }
				offset = localOffset ;
			}
			else {
				offset = this.getOffset( x , y ) ;
			}

			sum += this.data[ offset + channel ] ;
		}
	}

	return Math.round( sum / count ) ;
} ;

ImageManipulator.prototype.horizontalBlurChannelValueAt = function( channel , atX , atY , params ) {
	var x , offset ,
		localOffset = this.getClampedOffset( atX , atY ) ,
		sum = 0 ,
		count = 0 ,
		xMin = atX - params.radius ,
		xMax = atX + params.radius ;

	for ( x = xMin ; x <= xMax ; x ++ ) {
		count ++ ;

		if ( x < 0 || x >= this.width ) {
			if ( params.outOfBoundIsBlack ) { continue ; }	// = zero/black
			//if ( params.clamp ) { offset = this.getClampedOffset( x , y ) ; }
			offset = localOffset ;
		}
		else {
			offset = this.getOffset( x , atY ) ;
		}

		sum += this.data[ offset + channel ] ;
	}

	return Math.round( sum / count ) ;
} ;

ImageManipulator.prototype.verticalBlurChannelValueAt = function( channel , atX , atY , params ) {
	var y , offset ,
		localOffset = this.getClampedOffset( atX , atY ) ,
		sum = 0 ,
		count = 0 ,
		yMin = atY - params.radius ,
		yMax = atY + params.radius ;

	for ( y = yMin ; y <= yMax ; y ++ ) {
		count ++ ;
		if ( y < 0 || y >= this.height ) {
			if ( params.outOfBoundIsBlack ) { continue ; }	// = zero/black
			//if ( params.clamp ) { offset = this.getClampedOffset( x , y ) ; }
			offset = localOffset ;
		}
		else {
			offset = this.getOffset( atX , y ) ;
		}

		sum += this.data[ offset + channel ] ;
	}

	return Math.round( sum / count ) ;
} ;



// channels: array of channel names/indexes to blur
ImageManipulator.prototype.bevel = function( to , area , params = {} ) {
	return this.combine( to , area , null , ImageManipulator.bevelOffset , {
		radius: + params.radius || 5 ,
		transform: TRANSFORM[ params.transform ] || TRANSFORM.identity ,
		channels: this.channelIndexes( params.channels )
	} ) ;
} ;

ImageManipulator.bevelOffset = function( from , offset , to , toOffset , mask , maskAlpha , x , y , params ) {
	// Filter transparency out now
	if ( from.hasChannel.alpha && ! from.data[ offset + from.alphaOffset ] ) { return ; }

	for ( let c = 0 ; c < params.channels.length ; c ++ ) {
		to.data[ toOffset + c ] = params.channels[ c ] ?
			from.channelClosestZeroDistanceAt( c , x , y , mask , params ) :
			from.data[ offset + c ] ;
	}
} ;



// This algorithm is not perfect, it can scan up to 40% more pixel, in case the closest point is in diagonal
function findClosestIteration( atX , atY , minRadius , maxRadius , fn ) {
	var depth , x , y , xMin , xMax , yMin , yMax , dx , dy , d2 ,
		minRadius2 = minRadius * minRadius ,
		maxRadius2 = maxRadius * maxRadius ,
		minD2 = Infinity ,
		minDepth = Math.floor( minRadius * Math.SQRT1_2 ) ,
		//minDepth = Math.floor( minRadius ) ,
		maxDepth = Math.ceil( maxRadius ) ;

	if ( minDepth === 0 ) {
		// If we start at radius=0 and found our point, leave now!
		if ( fn( atX , atY , 0 ) ) { return ; }
		minDepth = 1 ;
	}

	for ( depth = minDepth ; depth <= maxDepth && depth < minD2 ; depth ++ ) {
		xMin = atX - depth ;
		xMax = atX + depth ;
		yMin = atY - depth ;
		yMax = atY + depth ;

		// Top + Bottom, they share the same distance
		for ( x = xMin ; x <= xMax ; x ++ ) {
			dx = x - atX ;
			d2 = dx * dx + depth * depth ;
			if ( d2 < minRadius2 || d2 > maxRadius2 || d2 >= minD2 ) { continue ; }
			if ( fn( x , yMin , d2 ) ) { minD2 = d2 ; }	// if the top point match, it is useless to check for the bottom point
			else if ( fn( x , yMax , d2 ) ) { minD2 = d2 ; }
		}

		// Left + Right, they share the same distance
		// Also we avoid checking the corner points twice, hence the "yMin + 1" and "< yMax"
		for ( y = yMin + 1 ; y < yMax ; y ++ ) {
			dy = y - atY ;
			d2 = dy * dy + depth * depth ;
			if ( d2 < minRadius2 || d2 > maxRadius2 || d2 >= minD2 ) { continue ; }
			if ( fn( xMin , y , d2 ) ) { minD2 = d2 ; }	// if the left point match, it is useless to check for the right point
			else if ( fn( xMax , y , d2 ) ) { minD2 = d2 ; }
		}
	}
}



// Get the distance to the closest zero value for this channel
ImageManipulator.prototype.channelClosestZeroDistanceAt = function( channel , atX , atY , mask , params ) {
	var rate , offset , minD ,
		minRadius = 0 ,
		maxRadius = params.radius ,
		minD2 = params.radius * params.radius ;

	if ( params.lastY === atY ) {
		minRadius = Math.max( 0 , params.lastDistance - 1 ) ;
		maxRadius = Math.min( params.radius , params.lastDistance + 1 ) ;
	}

	findClosestIteration( atX , atY , minRadius , maxRadius , ( x , y , d2 ) => {
		if ( x < 0 || y < 0 || x >= this.width || y >= this.height ) {
			// Out of bound is considered as zero
			minD2 = d2 ;
			return true ;
		}

		offset = this.getOffset( x , y ) ;
		if ( ! this.data[ offset + channel ] ) { minD2 = d2 ; return true ; }
		else if ( mask && ! mask.getAlpha( x , y ) ) { minD2 = d2 ; return true ; }
		return false ;
	} ) ;

	minD = Math.sqrt( minD2 ) ;
	params.lastY = atY ;
	params.lastDistance = minD ;

	rate = params.transform( minD / params.radius ) ;
	return Math.round( 255 * rate ) ;
} ;



// Resampling, using bilinear filtering:
// https://rosettacode.org/wiki/Bilinear_interpolation#C

ImageManipulator.prototype.scaleBilinear = function( to , factor ) {
	var c , x , y , toOffset ,
		srcX , srcY , srcX00 , srcY00 , srcOffset00 , srcOffset10 , srcOffset01 , srcOffset11 ;

	if ( ! to ) {
		to = new ImageManipulator(
			null ,
			Math.round( this.width * factor ) ,
			Math.round( this.height * factor ) ,
			this.offsetToChannel
		) ;
	}
	else if ( ! ( to instanceof ImageManipulator ) ) {
		to = new ImageManipulator( to ) ;
	}

	for ( y = 0 ; y < to.height ; y ++ ) {
		for ( x = 0 ; x < to.width ; x ++ ) {
			toOffset = to.getOffset( x , y ) ;
			// Image should be clamped at the edges and not scaled.
			srcX = Math.min( x / to.width * this.width - 0.5 , this.width - 1 ) ;
			srcY = Math.min( y / to.height * this.height - 0.5 , this.height - 1 ) ;
			srcX00 = Math.floor( srcX ) ;
			srcY00 = Math.floor( srcY ) ;
			srcOffset00 = this.getClampedOffset( srcX00 , srcY00 ) ;
			srcOffset10 = this.getClampedOffset( srcX00 + 1 , srcY00 ) ;
			srcOffset01 = this.getClampedOffset( srcX00 , srcY00 + 1 ) ;
			srcOffset11 = this.getClampedOffset( srcX00 + 1 , srcY00 + 1 ) ;

			for( c = 0 ; c < this.channels ; c ++ ) {
				to.data[ toOffset + c ] = helpers.bilinearLerp(
					this.data[ srcOffset00 + c ] ,
					this.data[ srcOffset10 + c ] ,
					this.data[ srcOffset01 + c ] ,
					this.data[ srcOffset11 + c ] ,
					srcX - srcX00 ,
					srcY - srcY00
				) ;
			}
		}
	}

	return to ;
} ;

