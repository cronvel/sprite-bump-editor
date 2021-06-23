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



const fs = require( 'fs' ) ;
const stream = require( 'stream' ) ;
const zlib = require( 'zlib' ) ;

const streamKit = require( 'stream-kit' ) ;
const Promise = require( 'seventh' ) ;



// Loader/saver for ImageManipulator

function ImageManipulatorFile( image ) {
	this.image = image ;
}

module.exports = ImageManipulatorFile ;



ImageManipulatorFile.prototype.save = function( filepath ) {
	var promise = new Promise() ,
		fileStream = fs.createWriteStream( filepath ) ,
		//compressStream = zlib.createGzip() ,
		compressStream = zlib.createBrotliCompress() ,
		input = compressStream ;
	
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

