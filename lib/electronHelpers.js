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



electronHelpers.save = async ( filePath , data ) => {
	var buffer , filePath ;
	
	if ( data instanceof Blob ) {
		buffer = Buffer.from( await data.arrayBuffer() ) ;
	}
	else {
		buffer = Buffer.from( data ) ;
	}

	try {
		await fs.writeFile( filePath , buffer ) ;
	}
	catch ( error ) {
		return false ;
	}

	return true ;
} ;



electronHelpers.loadImage = async ( filePath ) => {
	var image = new Image() ;
	image.src = filePath ;

	var promise = new Promise() ;
	image.onload = () => promise.resolve( image ) ;
	return promise ;
} ;



function commonFileOptions( options_ = {} ) {
	var options = {
		title: options_.title || '' ,
		defaultPath: options_.defaultPath || os.homedir() ,
		properties: [] ,
	} ;

	if ( options_.file || options_.file === undefined ) { options.properties.push( 'openFile' ) ; }
	if ( options_.directory ) { options.properties.push( 'openDirectory' ) ; }
	if ( options_.multi ) { options.properties.push( 'multiSelections' ) ; }

	if ( Array.isArray( options_.extensions ) ) {
		options.filters = options_.extensions.map( extensions => {
			var name ;

			if ( extensions && typeof extensions === 'object' ) {
				( { extensions , name } = extensions ) ;
			}
			
			if ( ! extensions ) { console.warn( "not extensions!" ) ; return null ; }

			if ( ! name || typeof name !== 'string' ) { name = 'file' ; }

			if ( typeof extensions === 'string' ) {
				return {
					name ,
					extensions: [ extensions ]
				} ;
			}

			if ( Array.isArray( extensions ) ) {
				return {
					name ,
					extensions: extensions.filter( str => str && typeof str === 'string' )
				} ;
			}

			return null ;
		} ).filter( e => e !== null ) ;
	}
	
	return options ;
}



electronHelpers.loadDialog = ( options = {} ) => {
	if ( ! options.title ) { options.title = "Load file" ; }
	return electron.ipcRenderer.invoke( 'loadDialog' , commonFileOptions( options ) ) ;
} ;



electronHelpers.saveDialog = ( options = {} ) => {
	if ( ! options.title ) { options.title = "Save file" ; }
	return electron.ipcRenderer.invoke( 'saveDialog' , commonFileOptions( options ) ) ;
} ;

