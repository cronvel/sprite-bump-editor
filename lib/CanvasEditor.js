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



const electronHelpers = require( './electronHelpers.js' ) ;
const Promise = require( 'seventh' ) ;



function CanvasEditor( ctx ) {
	this.ctx = ctx ;
	this.colorCode = '#8080ff' ;
	this.brushSize = 12 ;
	this.history = [] ;		// Contains ImageData
	this.historyIndex = -1 ;

	this.lastDrawAt = null ;
}

module.exports = CanvasEditor ;



CanvasEditor.prototype.setColor = function( code ) { this.colorCode = code ; } ;



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
	var promise = new Promise() ;
	this.ctx.canvas.toBlob(
		blob => Promise.propagate( electronHelpers.saveBlobWithDialog( blob , "normal.png" , promise ) ) ,
		'image/png'
	) ;
	return promise ;
} ;



CanvasEditor.prototype.load = async function() {
	var image = await electronHelpers.loadImageWithDialog() ;
	console.warn( "Image:" , image ) ;
	if ( image ) { this.setImage( image ) ; }
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

	// Draw the disc
	if ( ! this.lastDrawAt ) { this.drawBrushStampAt( position ) ; }
	else { this.drawBrushLine( this.lastDrawAt , position ) ; }

	this.lastDrawAt = position ;
	return true ;	// <-- something changed
} ;



CanvasEditor.prototype.drawBrushStampAt = function( position ) {
	this.ctx.fillStyle = this.colorCode ;
	this.ctx.beginPath() ;
	this.ctx.arc( position.x , position.y , this.brushSize , 0 , 2 * Math.PI , false ) ;
	this.ctx.fill() ;
} ;



CanvasEditor.prototype.drawBrushLine = function( from , to ) {
	this.ctx.fillStyle = this.colorCode ;

	var angle = Math.atan2( to.y - from.y , to.x - from.x ) ,
		orthoX = Math.cos( angle + Math.PI / 2 ) ,
		orthoY = Math.sin( angle + Math.PI / 2 ) ;

	this.ctx.beginPath() ;
	this.ctx.arc( from.x , from.y , this.brushSize , angle - Math.PI / 2 , angle + Math.PI / 2 , true ) ;
	this.ctx.lineTo( to.x + orthoX * this.brushSize , to.y + orthoY * this.brushSize ) ;
	this.ctx.arc( to.x , to.y , this.brushSize , angle + Math.PI / 2 , angle - Math.PI / 2 , true ) ;
	this.ctx.lineTo( from.x - orthoX * this.brushSize , from.y - orthoY * this.brushSize ) ;
	this.ctx.fill() ;
} ;



CanvasEditor.prototype.finishDraw = function() {
	if ( ! this.lastDrawAt ) { return false ; }
	this.lastDrawAt = null ;
	this.pushHistory() ;
	return false ;	// <-- nothing changed ATM
} ;

