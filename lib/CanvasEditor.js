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



const FileSaver = require( 'file-saver' ) ;



function CanvasEditor( ctx ) {
	this.ctx = ctx ;
	this.colorCode = '#8080ff' ;
	this.brushSize = 12 ;
	this.history = [] ;		// Contains ImageData
	this.historyIndex = -1 ;

	this.isDrawing = false ;
}

module.exports = CanvasEditor ;



CanvasEditor.prototype.setColor = function( code ) { this.colorCode = code ; }



CanvasEditor.prototype.pushHistory = function() {
	var imageData = this.history[ ++ this.historyIndex ] = this.ctx.getImageData( 0 , 0 , this.ctx.canvas.width , this.ctx.canvas.height ) ;
	this.history.length = this.historyIndex + 1 ;
	console.warn( "imagaData:" , imageData ) ;
} ;



CanvasEditor.prototype.undo = function() {
	if ( this.historyIndex <= 0 ) { return false ; }
	var imageData = this.history[ -- this.historyIndex ] ;
	this.ctx.putImageData( imageData , 0 , 0 ) ;
	return true ;
} ;



CanvasEditor.prototype.redo = function() {
	if ( this.historyIndex >= this.history.length - 1 ) { return false ; }
	var imageData = this.history[ ++ this.historyIndex ] ;
	this.ctx.putImageData( imageData , 0 , 0 ) ;
	return true ;
} ;



CanvasEditor.prototype.save = function() {
	this.ctx.canvas.toBlob( blob => FileSaver.saveAs( blob , "normal.png" ) , 'image/png' ) ;
} ;



CanvasEditor.prototype.load = function() {
	//this.ctx.canvas.toBlob( blob => FileSaver.saveAs( blob , "normal.png" ) , 'image/png' ) ;
} ;



CanvasEditor.prototype.setImage = function( image ) {
	this.ctx.drawImage( image , 0 , 0 ) ;
	this.pushHistory() ;
} ;



CanvasEditor.prototype.fromTextureCoordinates = function( position ) {
	position.x = position.x * this.ctx.canvas.width ;
	position.y = ( 1 - position.y ) * this.ctx.canvas.height ;
} ;



CanvasEditor.prototype.draw = function( position , fromTexCoord = false ) {
	if ( fromTexCoord ) { this.fromTextureCoordinates( position ) ; }
	this.isDrawing = true ;

	// Draw the disc
	this.ctx.beginPath() ;
	this.ctx.arc( position.x , position.y , this.brushSize , 0 , 2 * Math.PI , false ) ;
	this.ctx.fillStyle = this.colorCode ;
	this.ctx.fill() ;
	return true ;	// <-- something changed
} ;



CanvasEditor.prototype.finishDraw = function() {
	if ( ! this.isDrawing ) { return false ; }
	this.isDrawing = false ;
	this.pushHistory() ;
	return false ;	// <-- nothing changed ATM
} ;

