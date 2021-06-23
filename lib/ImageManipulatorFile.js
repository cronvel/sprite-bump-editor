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



const ImageManipulator = require( './ImageManipulator.js' ) ;

const fs = require( 'fs' ) ;
const stream = require( 'stream' ) ;
const zlib = require( 'zlib' ) ;

const streamKit = require( 'stream-kit' ) ;
const Promise = require( 'seventh' ) ;



// Loader/saver for ImageManipulator

const DEFAULT_RGBA_BLOCKS = [
	{ channels: [ 'alpha' ] } ,
	{ channels: [ 'red' , 'green' , 'blue' ] }
] ;

const DEFAULT_RGB_BLOCKS = [
	{ channels: [ 'red' , 'green' , 'blue' ] }
] ;

function ImageManipulatorFile( image , params = {} ) {
	this.image = image ;
	this.blocks = null ;
	
	if ( params.blocks ) {
		this.blocks = params.blocks.map( p => new Block( p ) ) ;
	}
	else if ( this.image.isRGBA ) {
		this.blocks = DEFAULT_RGBA_BLOCKS.map( p => new Block( p ) ) ;
	}
	else if ( ImageManipulator.areSameChannels( this.image.offsetToChannel , ImageManipulator.channels.RGB ) ) {
		this.blocks = DEFAULT_RGB_BLOCKS.map( p => new Block( p ) ) ;
	}
	else {
		this.blocks = this.image.offsetToChannel.map( channel => new Block( { channels: [ channel ] } ) ) ;
	}
}

module.exports = ImageManipulatorFile ;



function Block( params ) {
	this.channels = params.channels || [] ;	// The grouped/joint channel for this block
	this.alphaKey = params.alphaKey ;		// First block only, any pixel having zero for this channel will be skipped for all other channels
	this.indexed = !! params.indexed ;		// This block will use predefined indexed “palette”
	this.rle = !! params.rle ;				// This block encode repetition
	
	/*
		This mode will include pixel order modification in order to improve zlib's compression.
		* scanline: the default mode, it's the usual left to right first and top-bottom order.
		* quadtree: will recursively split the image in 4, like a quad-tree, so pixel of an area are done together,
			but there will be still jumps between pixels.
		* quadmaze: same than quadtree but each quad is done in a very specific order so pixel consecutively stored are close
			in the real image
		
		Also quad are constructed from the leaf, which is always the minimal quad of 4 pixels.
		This will produce out of image coordinates, which are simply skipped.
	*/
	this.scan = params.scan || 'scanline' ;
}



ImageManipulatorFile.prototype.buildHeader = function() {
	var header = {
		version: '0.1' ,
		width: this.image.width ,
		height: this.image.height ,
		channels: this.image.offsetToChannel ,
		blocks: this.blocks ,
		meta: {}
	} ;
	
	return header ;
} ;



ImageManipulatorFile.prototype.save = function( filepath ) {
	var promise = new Promise() ,
		fileStream = fs.createWriteStream( filepath ) ,
		//compressStream = zlib.createGzip() ,
		compressStream = zlib.createBrotliCompress() ,
		input = compressStream ;
	
	var header = JSON.stringify( this.buildHeader() ) ;
	console.warn( "header:" , header.length , header ) ;

	input.write( Buffer.from( this.image.data ) ) ;
	input.end() ;
	stream.pipeline( compressStream , fileStream , error => {
		if ( error ) {
			console.warn( "Error:" , error ) ;
			promise.reject( error ) ;
			return ;
		}

		promise.resolve() ;
	} ) ;
	
	return promise ;
} ;



ImageManipulatorFile.prototype.load = function( filepath ) {
	var promise = new Promise() ,
		fileStream = fs.createReadStream( filepath ) ,
		//compressStream = zlib.createGunzip() ,
		compressStream = zlib.createBrotliDecompress() ,
		output = new streamKit.WritableToBuffer() ;
	
	stream.pipeline( fileStream , compressStream , output , error => {
		if ( error ) {
			console.warn( "Error:" , error ) ;
			promise.reject( error ) ;
			return ;
		}

		this.image.data.set( output.get() ) ;
		promise.resolve() ;
	} ) ;
	
	return promise ;
} ;

