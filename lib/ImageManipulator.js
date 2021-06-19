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
const RG = [ 'red' , 'green' ] ;	// Useful for normals, the blue channel can be reconstructed from red and green
const RGB = [ 'red' , 'green' , 'blue' ] ;
const RGBA = [ 'red' , 'green' , 'blue' , 'alpha' ] ;
const PER_CHANNEL_COUNT = [ null , MONO , RG , RGB , RGBA ] ;

ImageManipulator.channels = {
	MONO , MONO_A , RG , RGB , RGBA
} ;

const TRANSFORM = {
	identity: x => x ,
	circular: x => Math.sqrt( 2 * x - x * x )	// Circle formula reversed from sqrt( 1 - x² ), with x -> 1 - x
} ;

// Aliases
TRANSFORM.linear = TRANSFORM.identity ;
TRANSFORM.round = TRANSFORM.circular ;



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



ImageManipulator.prototype.disc = function( cx , cy , hardRadius , softRadius , color , mask = null ) {
	var x , y , dx , dy , d , alpha , maskOffset ,
		useAlpha = !! this.hasChannel.alpha  ,
		alphaBase = color.a !== undefined ? color.a : 255 ,
		colorArray = new Array( this.channels ).fill( 0 ) ,
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
			if ( useAlpha ) {
				alpha = this.alphaDecay( alphaBase , d , hardRadius , softRadius ) ;
				if ( mask ) { alpha *= mask.getNormalizedAlpha( x , y ) ; }
				colorArray[ this.alphaOffset ] = alpha ;
			}
			this.setPixelIfGreaterAlpha( x , y , colorArray ) ;
		}
	}
} ;



ImageManipulator.prototype.thickLine = function( fromX , fromY , toX , toY , hardThickness , softThickness , color , mask = null ) {
	if ( fromX === toX || fromY === toY ) {
		return this.disc( fromX , fromY , hardThickness , softThickness , color , mask ) ;
	}

	var x , y , dx , dy , d ,
		lineDistance , segmentProjection , alpha ,
		useAlpha = !! this.hasChannel.alpha  ,
		alphaBase = color.a !== undefined ? color.a : 255 ,
		colorArray = new Array( this.channels ).fill( 0 ) ,
		segment = new Segment( fromX , fromY , toX , toY ) ,
		xMin = Math.max( 0 , Math.floor( Math.min( fromX , toX ) - softThickness ) ) ,
		xMax = Math.min( this.width - 1 , Math.ceil( Math.max( fromX , toX ) + softThickness ) ) ,
		yMin = Math.max( 0 , Math.floor( Math.min( fromY , toY ) - softThickness ) ) ,
		yMax = Math.min( this.height - 1 , Math.ceil( Math.max( fromY , toY ) + softThickness ) ) ;
	//console.warn( ".disc()" , cx , cy , hardThickness , softThickness , color , xMin , xMax , yMin , yMax ) ;

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
				if ( d >= softThickness ) { continue ; }
				if ( useAlpha ) {
					alpha = this.alphaDecay( alphaBase , d , hardThickness , softThickness ) ;
					if ( mask ) { alpha *= mask.getNormalizedAlpha( x , y ) ; }
					colorArray[ this.alphaOffset ] = alpha ;
				}
				this.setPixelIfGreaterAlpha( x , y , colorArray ) ;
				continue ;
			}

			lineDistance = segment.lineDistance( x , y ) ;
			if ( lineDistance >= softThickness ) { continue ; }
			if ( useAlpha ) {
				alpha = this.alphaDecay( alphaBase , lineDistance , hardThickness , softThickness ) ;
				if ( mask ) { alpha *= mask.getNormalizedAlpha( x , y ) ; }
				colorArray[ this.alphaOffset ] = alpha ;
			}
			this.setPixelIfGreaterAlpha( x , y , colorArray ) ;
		}
	}
} ;



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

ImageManipulator.prototype.copyTo = function( to , area ) {
	return this.combine( to , area , ImageManipulator.copyOffset , ImageManipulator.sameChannelsCopyOffset ) ;
} ;



ImageManipulator.compatibleCopyOffset = function( from , offset , to , toOffset , mask , maskAlpha , x , y , params ) {
	var c , channel , value ;

	if ( params.computeAverage ) { value = from.averageValueAtOffset( offset ) ; }

	for ( c = 0 ; c < to.channels ; c ++ ) {
		channel = to.offsetToChannel[ c ] ;
		if ( from.hasChannel[ channel ] ) {
			to.data[ toOffset + c ] = from.data[ offset + from.channelToOffset[ channel ] ] ;
		}
		else if ( from.hasChannel.mono ) {
			to.data[ toOffset + c ] = from.data[ offset + from.channelToOffset.mono ] ;
		}
		else if ( channel === to.channelToOffset.mono ) {
			to.data[ toOffset + c ] = value ;
		}
	}
} ;

ImageManipulator.prototype.compatibleCopyTo = function( to , area ) {
	var fn = ImageManipulator.copyOffset ,
		params = {} ;

	if ( this.hasChannel.mono || to.hasChannel.mono ) {
		fn = ImageManipulator.compatibleCopyOffset ;
		if ( to.hasChannel.mono && ! this.hasChannel.mono ) { params.computeAverage = true ; }
	}

	return this.combine( to , area , fn , ImageManipulator.sameChannelsCopyOffset ) ;
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

ImageManipulator.prototype.toMono = function( to , area , toChannels = MONO ) {
	if ( ! to ) { to = new ImageManipulator( null , this.width , this.height , toChannels ) ; }
	else if ( ! ( to instanceof ImageManipulator ) ) { to = new ImageManipulator( to ) ; }

	return this.combine( to , area , ImageManipulator.toMonoOffset ) ;
} ;



ImageManipulator.alphaToMonoOffset = function( from , offset , to , toOffset ) {
	for ( let c = 0 ; c < to.channels ; c ++ ) {
		to.data[ toOffset + c ] = c === to.alphaOffset ? 255 : from.data[ offset + from.alphaOffset ] ;
	}
} ;

ImageManipulator.prototype.alphaToMono = function( to , area , toChannels = MONO ) {
	if ( ! to ) { to = new ImageManipulator( null , this.width , this.height , toChannels ) ; }
	else if ( ! ( to instanceof ImageManipulator ) ) { to = new ImageManipulator( to ) ; }
	if ( ! this.hasChannel.alpha ) { throw new Error( ".alphaToMono(): alpha channel is required" ) ; }

	return this.combine( to , area , ImageManipulator.alphaToMonoOffset ) ;
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

ImageManipulator.prototype.mergeInto = function( to , area , forceOpaque = false ) {
	if ( ! this.hasChannel.alpha ) { throw new Error( ".mergeInto(): alpha channel is required" ) ; }
	//return this.combine( to , area , null , ImageManipulator.sameChannelsMergeOffset , { forceOpaque } ) ;
	//return this.combine( to , area , ImageManipulator.mergeOffset , null , { forceOpaque } ) ;
	return this.combine( to , area , ImageManipulator.mergeOffset , ImageManipulator.sameChannelsMergeOffset , { forceOpaque } ) ;
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

ImageManipulator.prototype.mixInto = function( to , area , mix = 0.5 ) {
	return this.combine( to , area , ImageManipulator.mixOffset , ImageManipulator.sameChannelsMixOffset , { mix , invMix: 1 - mix } ) ;
} ;



const REUSABLE_NORMAL = { x: 0 , y: 0 , z: 0 } ;
const REUSABLE_RGB = { r: 0 , g: 0 , b: 0 } ;

// Constraint: I:mono O:rgb
ImageManipulator.heightMapToNormalOffset = function( from , offset , to , toOffset , mask , maskAlpha , x , y , params ) {
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



ImageManipulator.prototype.heightMapToNormal = function( to , area , params = {} ) {
	if ( this.offsetToChannel[ 0 ] !== 'mono' ) {
		throw new Error( '.heightToNormal(): uncompatible channels' ) ;
	}

	if ( ! to ) { to = new ImageManipulator( null , this.width , this.height , RGB ) ; }
	else if ( ! ( to instanceof ImageManipulator ) ) { to = new ImageManipulator( to ) ; }

	if ( to.offsetToChannel[ 0 ] !== 'red' || to.offsetToChannel[ 1 ] !== 'green' || to.offsetToChannel[ 2 ] !== 'blue' ) {
		throw new Error( '.heightToNormal(): uncompatible destination channels' ) ;
	}

	return this.combine( to , area , ImageManipulator.heightMapToNormalOffset , null , {
		height: + params.height || 10
	} ) ;
} ;



ImageManipulator.blurOffset = function( from , offset , to , toOffset , mask , maskAlpha , x , y , params ) {
	var c , fromValue , toValue ;

	// Filter transparency out now
	if ( from.hasChannel.alpha && ! from.data[ offset + from.alphaOffset ] ) { return ; }

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
ImageManipulator.prototype.blur = function( to , area , params = {} ) {
	return this.combine( to , area , null , ImageManipulator.blurOffset , {
		radius: + params.radius || 5 ,
		clamp: !! params.clamp ,
		erosion: !! params.erosion ,
		channels: this.channelIndexes( params.channels )
	} ) ;
} ;



ImageManipulator.horizontalBlurOffset = function( from , offset , to , toOffset , mask , maskAlpha , x , y , params ) {
	// Filter transparency out now
	if ( from.hasChannel.alpha && ! from.data[ offset + from.alphaOffset ] ) { return ; }

	for ( let c = 0 ; c < params.channels.length ; c ++ ) {
		to.data[ toOffset + c ] = params.channels[ c ] ?
			from.horizontalBlurChannelValueAt( c , x , y , params ) :
			from.data[ offset + c ] ;
	}
} ;

// channels: array of channel names/indexes to blur
ImageManipulator.prototype.horizontalBlur = function( to , area , params = {} ) {
	return this.combine( to , area , null , ImageManipulator.horizontalBlurOffset , {
		radius: Math.ceil( + params.radius || 5 ) ,
		clamp: !! params.clamp ,
		erosion: !! params.erosion ,
		channels: this.channelIndexes( params.channels )
	} ) ;
} ;



ImageManipulator.verticalBlurOffset = function( from , offset , to , toOffset , mask , maskAlpha , x , y , params ) {
	// Filter transparency out now
	if ( from.hasChannel.alpha && ! from.data[ offset + from.alphaOffset ] ) { return ; }

	for ( let c = 0 ; c < params.channels.length ; c ++ ) {
		to.data[ toOffset + c ] = params.channels[ c ] ?
			from.verticalBlurChannelValueAt( c , x , y , params ) :
			from.data[ offset + c ] ;
	}
} ;

// channels: array of channel names/indexes to blur
ImageManipulator.prototype.verticalBlur = function( to , area , params = {} ) {
	return this.combine( to , area , null , ImageManipulator.verticalBlurOffset , {
		radius: Math.ceil( + params.radius || 5 ) ,
		clamp: !! params.clamp ,
		erosion: !! params.erosion ,
		channels: this.channelIndexes( params.channels )
	} ) ;
} ;



// clamp: false=border are zero (black); true=border are clamped (same color repeat
ImageManipulator.prototype.blurChannelValueAt = function( channel , atX , atY , params ) {
	var x , y , dx , dy , d2 , offset ,
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
				if ( params.clamp ) { offset = this.getClampedOffset( x , y ) ; }
				else { continue ; }	// = zero/black
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
		sum = 0 ,
		count = 0 ,
		xMin = atX - params.radius ,
		xMax = atX + params.radius ;

	for ( x = xMin ; x <= xMax ; x ++ ) {
		count ++ ;
		if ( x < 0 || x >= this.width ) {
			if ( params.clamp ) { offset = this.getClampedOffset( x , atY ) ; }
			else { continue ; }	// = zero/black
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
		sum = 0 ,
		count = 0 ,
		yMin = atY - params.radius ,
		yMax = atY + params.radius ;

	for ( y = yMin ; y <= yMax ; y ++ ) {
		count ++ ;
		if ( y < 0 || y >= this.height ) {
			if ( params.clamp ) { offset = this.getClampedOffset( atX , y ) ; }
			else { continue ; }	// = zero/black
		}
		else {
			offset = this.getOffset( atX , y ) ;
		}

		sum += this.data[ offset + channel ] ;
	}

	return Math.round( sum / count ) ;
} ;



ImageManipulator.embossOffset = function( from , offset , to , toOffset , mask , maskAlpha , x , y , params ) {
	// Filter transparency out now
	if ( from.hasChannel.alpha && ! from.data[ offset + from.alphaOffset ] ) { return ; }

	for ( let c = 0 ; c < params.channels.length ; c ++ ) {
		to.data[ toOffset + c ] = params.channels[ c ] ?
			from.channelClosestZeroDistanceAt( c , x , y , mask , params ) :
			from.data[ offset + c ] ;
	}
} ;

// channels: array of channel names/indexes to blur
ImageManipulator.prototype.emboss = function( to , area , params = {} ) {
	return this.combine( to , area , null , ImageManipulator.embossOffset , {
		radius: + params.radius || 5 ,
		transform: TRANSFORM[ params.transform ] || TRANSFORM.identity ,
		channels: this.channelIndexes( params.channels )
	} ) ;
} ;



// Get the distance to the closest zero value for this channel
ImageManipulator.prototype.channelClosestZeroDistanceAt = function( channel , atX , atY , mask , params ) {
	var x , y , dx , dy , rate , d2 , offset ,
		minD2 = params.radius * params.radius ,
		integerRadius = Math.ceil( params.radius ) ,
		xMin = atX - integerRadius ,
		xMax = atX + integerRadius ,
		yMin = atY - integerRadius ,
		yMax = atY + integerRadius ;


	// /!\ The loop must be optimized, spiraling out from (atX,atY)


	for ( y = yMin ; y <= yMax ; y ++ ) {
		dy = y - atY ;

		for ( x = xMin ; x <= xMax ; x ++ ) {
			dx = x - atX ;
			d2 = dx * dx + dy * dy ;
			if ( d2 >= minD2 ) { continue ; }

			if ( x < 0 || y < 0 || x >= this.width || y >= this.height ) {
				// Out of bound is considered as zero
				minD2 = d2 ;
			}
			else {
				offset = this.getOffset( x , y ) ;
				if ( ! this.data[ offset + channel ] ) { minD2 = d2 ; }
				else if ( mask && ! mask.getAlpha( x , y ) ) { minD2 = d2 ; }
			}
		}
	}

	rate = params.transform( Math.sqrt( minD2 ) / params.radius ) ;
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

