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

function ImageManipulatorFile( params = {} ) {
	this.compression = ImageManipulatorFile.compression[ params.compression ] || ImageManipulatorFile.compression.default ;
	this.blocks = ( params.blocks || ImageManipulatorFile.blocks.DEFAULT_RGBA ).map( p => new Block( p ) ) ;
	this.perImageBlocks = !! params.perImageBlocks ;	// if true, each image have its own block definition, if false, blocks are repeated for each image
}

module.exports = ImageManipulatorFile ;



ImageManipulatorFile.compression = {
	raw: {
		code: 'RAW_' ,
		compress: v => v instanceof Buffer ? v : Buffer.from( v ) ,
		decompress: v => v
	} ,
	brotli: {
		code: 'BRTL' ,
		compress: Promise.promisify( zlib.brotliCompress , zlib ) ,
		decompress: Promise.promisify( zlib.brotliDecompress , zlib )
	}
} ;
ImageManipulatorFile.compression.default = ImageManipulatorFile.compression[ 'BRTL' ] = ImageManipulatorFile.compression.brotli ;
ImageManipulatorFile.compression[ 'RAW_' ] = ImageManipulatorFile.compression.raw ;



ImageManipulatorFile.blocks = {} ;
ImageManipulatorFile.blocks.DEFAULT_RGBA = [
	{ channels: [ 'alpha' ] , isZeroChannel: true } ,
	{ channels: [ 'red' , 'green' , 'blue' ] , skipZero: true }
] ;

ImageManipulatorFile.blocks.DEFAULT_RGB = [
	{ channels: [ 'red' , 'green' , 'blue' ] }
] ;



function Block( params ) {
	// Multiple image/frame can be stored inside the .imf format, like base texture+normal, or animation
	this.imageKey = '' + params.imageKey || null ;

	// The grouped/joint channel for this block
	this.channels = params.channels || [] ;

	// Set this channel as used as alphaZero
	this.isZeroChannel = !! params.isZeroChannel ;

	// Skip any pixel having alpha/<channel>=0, skipZero should be set by a previous block
	this.skipZero = !! params.skipZero ;
	
	// Common values for skipped pixel
	this.skippedValues = this.skipZero && Array.isArray( params.skippedValues ) ? params.skippedValues : null ;

	// This block will use predefined indexed “palette”
	this.indexed = !! params.indexed ;

	// This block is encoded with “repetition mapping” (not sure if it is useful before Brotli)
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



ImageManipulatorFile.prototype.buildBlock = function( block , image , runtime ) {
	var c ,
		channels = block.channels.map( name => image.channelToOffset[ name ] ) ,
		offset = 0 ,
		offsetMax = image.data.length ,
		step = image.channels ,
		bOffset = 0 ,
		bStep = block.channels.length ,
		buffer = Buffer.allocUnsafe( image.data.length * block.channels.length / image.channels ) ,
		skipZero = !! ( block.skipZero && runtime.zeroImage ) ,
		zOffset = 0 ,
		zStep = skipZero ? runtime.zeroImage.channels : 0 ;

	for ( ; offset < offsetMax ; offset += step , zOffset += zStep ) {
		if ( skipZero && ! runtime.zeroImage.data[ zOffset + runtime.zeroChannel ] ) { continue ; }

		for ( c = 0 ; c < bStep ; c ++ ) {
			buffer[ bOffset + c ] = image.data[ offset + channels[ c ] ] ;
		}

		bOffset += bStep ;
	}
	
	if ( block.isZeroChannel ) {
		runtime.zeroImage = image ;
		runtime.zeroChannel = channels[ 0 ] ;
	}

	console.warn( "buffer:" , buffer.length , bOffset , Math.round( 100 * bOffset / buffer.length ) ) ;
	return buffer.slice( 0 , bOffset ) ;
} ;



ImageManipulatorFile.prototype.extractBlock = function( block , buffer , image , runtime ) {
	var c ,
		channels = block.channels.map( name => image.channelToOffset[ name ] ) ,
		offset = 0 ,
		offsetMax = image.data.length ,
		step = image.channels ,
		bOffset = 0 ,
		bStep = block.channels.length ,
		skippedValues = Array.isArray( block.skippedValues ) ? block.skippedValues : new Array( channels.length ).fill( 0 ) ,
		skipZero = !! ( block.skipZero && runtime.zeroImage ) ,
		zOffset = 0 ,
		zStep = skipZero ? runtime.zeroImage.channels : 0 ;

	for ( ; offset < offsetMax ; offset += step , zOffset += zStep ) {
		//*
		if ( skipZero && ! runtime.zeroImage.data[ zOffset + runtime.zeroChannel ] ) {
			for ( c = 0 ; c < bStep ; c ++ ) {
				image.data[ offset + channels[ c ] ] = skippedValues[ c ] ;
			}

			continue ;
		}
		//*/

		for ( c = 0 ; c < bStep ; c ++ ) {
			image.data[ offset + channels[ c ] ] = buffer[ bOffset + c ] ;
		}

		bOffset += bStep ;
	}

	if ( block.isZeroChannel ) {
		runtime.zeroImage = image ;
		runtime.zeroChannel = channels[ 0 ] ;
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



ImageManipulatorFile.prototype.buildHeaderMulti = function( images ) {
	var baseImage = Object.values( images )[ 0 ] ;

	var header = {
		multi: true ,	// multiple images
		linked: true ,	// they share width/height and alphaZero
		width: baseImage.width ,
		height: baseImage.height ,
		images: {} ,
		perImageBlocks: this.perImageBlocks ,
		blocks: this.blocks ,
		meta: {}
	} ;

	for ( let [ key , image ] of Object.entries( images ) ) {
		header.images[ key ] = {
			width: image.width ,
			height: image.height ,
			channels: image.offsetToChannel
		} ;
	}

	console.warn( "Builded header:" , header.length , header ) ;
	return header ;
} ;



ImageManipulatorFile.prototype.save = async function( filePath , image ) {
	var block , runtime = {} ;

	var fileStream = fs.createWriteStream( filePath ) ;

	var sb = new streamKit.StreamBuffer( fileStream , 4 * 1024 ) ;
	await sb.writeUtf8( 'IMF' ) ;				// Mark format .imf
	await sb.writeUInt8( FORMAT_VERSION ) ;		// Format version
	await sb.writeUtf8( this.compression.code ) ;	// After this, the file is compressed

	// Write the header
	await sb.writeLps16Buffer( await this.compression.compress( JSON.stringify( this.buildHeader( image ) ) ) ) ;

	for ( block of this.blocks ) {
		await sb.writeLps32Buffer( await this.compression.compress( this.buildBlock( block , image , runtime ) ) ) ;
	}

	await sb.flush() ;
	fileStream.end() ;
	console.warn( "Saved " + filePath ) ;
} ;



ImageManipulatorFile.prototype.saveMulti = async function( filePath , images ) {
	var block , image , key , runtime = {} ;

	var fileStream = fs.createWriteStream( filePath ) ;

	var sb = new streamKit.StreamBuffer( fileStream , 4 * 1024 ) ;
	await sb.writeUtf8( 'IMF' ) ;				// Mark format .imf
	await sb.writeUInt8( FORMAT_VERSION ) ;		// Format version
	await sb.writeUtf8( this.compression.code ) ;	// After this, the file is compressed

	// Write the header
	await sb.writeLps16Buffer( await this.compression.compress( JSON.stringify( this.buildHeaderMulti( images ) ) ) ) ;

	if ( this.perImageBlocks ) {
		for ( block of this.blocks ) {
			image = images[ block.imageKey ] ;
			if ( ! image ) { throw new Error( "Image key '" + block.imageKey + "' not found." ) ; }
			await sb.writeLps32Buffer( await this.compression.compress( this.buildBlock( block , image , runtime ) ) ) ;
		}
	}
	else {
		for ( [ key , image ] of Object.entries( images ) ) {
			for ( block of this.blocks ) {
				await sb.writeLps32Buffer( await this.compression.compress( this.buildBlock( block , image , runtime ) ) ) ;
			}
		}
	}

	await sb.flush() ;
	fileStream.end() ;
	console.warn( "Saved " + filePath ) ;
} ;



ImageManipulatorFile.load = async function( filePath ) {
	var runtime = {} ;
	var fileStream = fs.createReadStream( filePath ) ;

	var sb = new streamKit.StreamBuffer( fileStream , 4 * 1024 ) ;

	// Check for format .imf
	if ( await sb.readUtf8( 3 ) !== 'IMF' ) { throw new Error( 'This is not an IMF file!' ) ; }

	// What should we do with the version?
	var version = await sb.readUInt8() ;

	// Compression, only BRTL (Brotli) is supported ATM
	var compressionCode = await sb.readUtf8( 4 ) ,
		compression = ImageManipulatorFile.compression[ compressionCode ] ;

	if ( ! compression ) { throw new Error( "Unknown compression '" + compressionCode + "'" ) ; }

	// Read the header
	var header = JSON.parse( await compression.decompress( await sb.readLps16Buffer() ) ) ;
	console.warn( "Loaded header:" , header ) ;

	var imFile = new ImageManipulatorFile( { compression , blocks: header.blocks } ) ;

	if ( header.multi ) {
		if ( ! header.linked ) { throw new Error( "Multi image without 'linked' mode is unsupported at the moment" ) ; }

		let images = {} ;

		for ( let block of imFile.blocks ) {
			if ( ! block.imageKey ) { throw new Error( "Multi image without 'imageKey' property in the block" ) ; }
			if ( ! header.images[ block.imageKey ] ) { throw new Error( "No image descriptor found for imageKey '" + block.imageKey + "'" ) ; }
			
			if ( ! images[ block.imageKey ] ) {
				images[ block.imageKey ] = new ImageManipulator( null , header.width , header.height , header.images[ block.imageKey ].channels ) ;
			}
			
			imFile.extractBlock( block , await compression.decompress( await sb.readLps32Buffer() ) , images[ block.imageKey ] , runtime ) ;
		}

		header.imageManipulators = images ;
	}
	else {
		let image = new ImageManipulator( null , header.width , header.height , header.channels ) ;

		for ( let block of imFile.blocks ) {
			imFile.extractBlock( block , await compression.decompress( await sb.readLps32Buffer() ) , image , runtime ) ;
		}

		header.imageManipulator = image ;
	}
	
	return header ;
} ;

