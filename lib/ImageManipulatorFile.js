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



// Version at the begining of the file
const FORMAT_VERSION = 1 ;

const ImageManipulator = require( './ImageManipulator.js' ) ;

const fs = require( 'fs' ) ;
//const stream = require( 'stream' ) ;
const zlib = require( 'zlib' ) ;

const streamKit = require( 'stream-kit' ) ;
const Promise = require( 'seventh' ) ;



// Loader/saver for ImageManipulator

function ImageManipulatorFile( blocks ) {
	this.blocks = blocks.map( p => new Block( p ) ) ;
}

module.exports = ImageManipulatorFile ;



ImageManipulatorFile.DEFAULT_RGBA = [
	{ channels: [ 'alpha' ] } ,
	{ channels: [ 'red' , 'green' , 'blue' ] , skipAlphaZero: true }
] ;

ImageManipulatorFile.DEFAULT_RGB = [
	{ channels: [ 'red' , 'green' , 'blue' ] }
] ;



function Block( params ) {
	// The grouped/joint channel for this block
	this.channels = params.channels || [] ;

	// Skip any pixel having alpha=0, alpha channel should be set in a previous block
	this.skipAlphaZero = params.skipAlphaZero ;

	// This block will use predefined indexed “palette”
	this.indexed = !! params.indexed ;

	// This block is encoded with “repetition mapping”
	this.rmap = !! params.rmap ;

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



ImageManipulatorFile.prototype.buildBlock = function( block , image ) {
	var c ,
		channels = block.channels.map( name => image.channelToOffset[ name ] ) ,
		offset = 0 ,
		offsetMax = image.data.length ,
		step = image.channels ,
		bOffset = 0 ,
		bStep = block.channels.length ,
		buffer = Buffer.allocUnsafe( image.data.length * block.channels.length / image.channels ) ;

	for ( ; offset < offsetMax ; offset += step ) {
		if ( block.skipAlphaZero && ! image.data[ offset + image.alphaOffset ] ) { continue ; }

		for ( c = 0 ; c < bStep ; c ++ ) {
			buffer[ bOffset + c ] = image.data[ offset + channels[ c ] ] ;
		}

		bOffset += bStep ;
	}

	console.warn( "buffer:" , buffer.length , bOffset , Math.round( 100 * bOffset / buffer.length ) ) ;
	return buffer.slice( 0 , bOffset ) ;
} ;



ImageManipulatorFile.prototype.extractBlock = function( block , buffer , image ) {
	var c ,
		channels = block.channels.map( name => image.channelToOffset[ name ] ) ,
		offset = 0 ,
		offsetMax = image.data.length ,
		step = image.channels ,
		bOffset = 0 ,
		bStep = block.channels.length ;

	for ( ; offset < offsetMax ; offset += step ) {
		if ( block.skipAlphaZero && ! image.data[ offset + image.alphaOffset ] ) {
			for ( c = 0 ; c < bStep ; c ++ ) {
				image.data[ offset + channels[ c ] ] = 0 ;
			}

			continue ;
		}

		for ( c = 0 ; c < bStep ; c ++ ) {
			image.data[ offset + channels[ c ] ] = buffer[ bOffset + c ] ;
		}

		bOffset += bStep ;
	}
} ;



ImageManipulatorFile.prototype.buildHeader = function( image ) {
	var header = {
		width: image.width ,
		height: image.height ,
		channels: image.offsetToChannel ,
		blocks: this.blocks ,
		meta: {}
	} ;

	console.warn( "Builded header:" , header.length , header ) ;
	return header ;
} ;



const brotliCompressAsync = Promise.promisify( zlib.brotliCompress , zlib ) ;
const brotliDecompressAsync = Promise.promisify( zlib.brotliDecompress , zlib ) ;

ImageManipulatorFile.prototype.save = async function( filepath , image ) {
	var fileStream = fs.createWriteStream( filepath ) ;

	var sb = new streamKit.StreamBuffer( fileStream , 4 * 1024 ) ;
	await sb.writeUtf8( 'IMF' ) ;				// Mark format .imf
	await sb.writeUInt8( FORMAT_VERSION ) ;		// Format version
	await sb.writeUtf8( 'BRTL' ) ;				// After this, the file is compressed using Brotli

	// Write the header
	await sb.writeLps16Buffer( await brotliCompressAsync( JSON.stringify( this.buildHeader( image ) ) ) ) ;

	for ( let block of this.blocks ) {
		await sb.writeLps32Buffer( await brotliCompressAsync( this.buildBlock( block , image ) ) ) ;
	}

	await sb.flush() ;
	fileStream.end() ;
	console.warn( "Saved " + filepath ) ;
} ;



ImageManipulatorFile.load = async function( filepath ) {
	var fileStream = fs.createReadStream( filepath ) ;

	var sb = new streamKit.StreamBuffer( fileStream , 4 * 1024 ) ;

	// Check for format .imf
	if ( await sb.readUtf8( 3 ) !== 'IMF' ) { throw new Error( 'This is not an IMF file!' ) ; }

	// What should we do with the version?
	var version = await sb.readUInt8() ;

	// Compression, only BRTL (Brotli) is supported ATM
	var compression = await sb.readUtf8( 4 ) ;
	if ( compression !== 'BRTL' ) { throw new Error( "Unknown compression '" + compression + "'" ) ; }

	// Write the header
	var header = JSON.parse( await brotliDecompressAsync( await sb.readLps16Buffer() ) ) ;
	console.warn( "Loaded header:" , header ) ;

	var image = new ImageManipulator( null , header.width , header.height , header.channels ) ;
	var imFile = new ImageManipulatorFile( header.blocks ) ;

	for ( let block of imFile.blocks ) {
		imFile.extractBlock( block , await brotliDecompressAsync( await sb.readLps32Buffer() ) , image ) ;
	}
	
	return image ;
} ;

