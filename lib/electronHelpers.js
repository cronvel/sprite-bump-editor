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



const os = require( 'os' ) ;
const fs = require( 'fs' ).promises ;
const electron = require( 'electron' ) ;

const string = require( 'string-kit' ) ;
const Promise = require( 'seventh' ) ;



const electronHelpers = {} ;
module.exports = electronHelpers ;



electronHelpers.saveDialog = async () => {
	var userChosenPath = await electron.remote.dialog.showSaveDialog( { defaultPath: os.homedir() } ) ;
	if ( ! userChosenPath || ! userChosenPath.filePath ) { return ; }
	return userChosenPath.filePath ;
} ;



electronHelpers.saveWithDialog = async ( data ) => {
	var buffer , filepath ;
	
	filepath = await electronHelpers.saveDialog() ;
	if ( ! filepath ) { return false ; }

	if ( data instanceof Blob ) {
		buffer = Buffer.from( await data.arrayBuffer() ) ;
	}
	else {
		buffer = Buffer.from( data ) ;
	}

	try {
		await fs.writeFile( filepath , buffer ) ;
	}
	catch ( error ) {
		return false ;
	}

	return true ;
} ;



electronHelpers.loadDialog = async () => {
	var userChosenPath = await electron.remote.dialog.showOpenDialog( { defaultPath: os.homedir() } ) ;
	if ( ! userChosenPath || userChosenPath.filePaths.length !== 1 ) { return ; }
	return userChosenPath.filePaths[ 0 ] ;
} ;



electronHelpers.loadImageWithDialog = async () => {
	var filepath = await electronHelpers.loadDialog() ;
	if ( ! filepath ) { return ; }

	var image = new Image() ;
	image.src = filepath ;

	var promise = new Promise() ;
	image.onload = () => promise.resolve( image ) ;
	return promise ;
} ;

