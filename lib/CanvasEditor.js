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



function CanvasEditor( ctx , overlayCtx , size ) {
	this.ctx = ctx ;
	this.overlayCtx = overlayCtx ;
	this.size = size ;
	this.colorCode = '#8080ff' ;
	this.brushSize = 12 ;
	this.drawOpacity = 1 ;
	this.history = [] ;		// Contains ImageData
	this.historyIndex = -1 ;

	this.lastDrawAt = null ;
	this.currentDrawBBox = null ;
	
	this.overlayCtx.fillStyle = '#00000000' ;
	this.overlayCtx.fillStyle = '#ff000080' ;
	this.overlayCtx.fillRect( 0 , 0 , this.size.width , this.size.height ) ;
}

module.exports = CanvasEditor ;



CanvasEditor.prototype.setColor = function( code ) { this.colorCode = code ; } ;
CanvasEditor.prototype.setOpacity = function( opacity ) { this.drawOpacity = Math.max( 0 , Math.min( 1 , + opacity || 0 ) ) ; } ;



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
	if ( ! this.lastDrawAt ) {
		this.currentDrawBBox = { xmin: position.x , xmax: position.x , ymin: position.y , ymax: position.y } ;
		this.drawBrushStampAt( position ) ;
	}
	else { this.drawBrushLine( this.lastDrawAt , position , true ) ; }

	this.lastDrawAt = position ;
	return true ;	// <-- something changed
} ;



CanvasEditor.prototype.drawBrushStampAt = function( position ) {
	//var ctx = this.ctx ;
	var ctx = this.overlayCtx ;

	ctx.fillStyle = this.colorCode ;
	ctx.globalAlpha = this.drawOpacity ;
	ctx.beginPath() ;
	ctx.arc( position.x , position.y , this.brushSize , 0 , 2 * Math.PI , false ) ;
	ctx.fill() ;
} ;



CanvasEditor.prototype.drawBrushLine = function( from , to , isContinue = false ) {
	//var ctx = this.ctx ;
	var ctx = this.overlayCtx ;

	ctx.fillStyle = this.colorCode ;
	ctx.globalAlpha = this.drawOpacity ;

	var angle = Math.atan2( to.y - from.y , to.x - from.x ) ,
		orthoX = Math.cos( angle + Math.PI / 2 ) ,
		orthoY = Math.sin( angle + Math.PI / 2 ) ;

	var gradient = ctx.createLinearGradient(
		from.x - orthoX * this.brushSize , from.y - orthoY * this.brushSize ,
		from.x + orthoX * this.brushSize , from.y + orthoY * this.brushSize
	) ;
	
	ctx.beginPath() ;
	ctx.arc( from.x , from.y , this.brushSize , angle - Math.PI / 2 , angle + Math.PI / 2 , ! isContinue ) ;
	ctx.lineTo( to.x + orthoX * this.brushSize , to.y + orthoY * this.brushSize ) ;
	ctx.arc( to.x , to.y , this.brushSize , angle + Math.PI / 2 , angle - Math.PI / 2 , true ) ;
	ctx.lineTo( from.x - orthoX * this.brushSize , from.y - orthoY * this.brushSize ) ;
	ctx.fill() ;
} ;



CanvasEditor.prototype.finishDraw = function() {
	//var ctx = this.ctx ;
	var ctx = this.overlayCtx ;

	if ( ! this.lastDrawAt ) { return false ; }
	this.lastDrawAt = null ;
	this.pushHistory() ;
	return false ;	// <-- nothing changed ATM
} ;

