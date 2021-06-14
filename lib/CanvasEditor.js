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

const helpers = require( './helpers.js' ) ;
const electronHelpers = require( './electronHelpers.js' ) ;
const Promise = require( 'seventh' ) ;



function CanvasEditor( ctx , previewCtx ) {
	this.ctx = ctx ;
	this.previewCtx = previewCtx ;
	//this.colorCode = '#8080ff' ;
	this.color = { r: 128 , g: 128 , b: 255 , a: 255 } ;
	this.brushRadius = 12 ;
	this.brushHardness = 0.5 ;
	this.brushOpacity = 1 ;
	this.history = [] ;		// Contains ImageData
	this.historyIndex = -1 ;

	this.lastDrawAt = null ;
	this.drawWindow = { xMin: 0 , xMax: 0 , yMin: 0 , yMax: 0 } ;
	this.drawUpdateWindow = { xMin: 0 , xMax: 0 , yMin: 0 , yMax: 0 } ;
	
	this.image = null ;
	this.accumulatorImageManipulator = new ImageManipulator( new ImageData( this.ctx.canvas.width , this.ctx.canvas.height ) ) ;
	
	this.previewCtx.clearRect( 0 , 0 , this.previewCtx.canvas.width , this.previewCtx.canvas.height ) ;
}

module.exports = CanvasEditor ;



CanvasEditor.prototype.setColor = function( color ) { Object.assign( this.color , color ) ; } ;
CanvasEditor.prototype.setBrushOpacity = function( opacity ) { this.brushOpacity = Math.max( 0 , Math.min( 1 , + opacity || 0 ) ) ; } ;
CanvasEditor.prototype.setBrushRadius = function( radius ) { this.brushRadius = radius ; } ;
CanvasEditor.prototype.setBrushHardness = function( hardness ) { this.brushHardness = hardness ; } ;

// Update the image, do it if the canvas was modified (e.g.: loading a texture)
CanvasEditor.prototype.updateFromCanvas = function() {
	this.image = this.ctx.getImageData( 0 , 0 , this.ctx.canvas.width , this.ctx.canvas.height ) ;
} ;

CanvasEditor.prototype.setImage = function( image ) {
	this.ctx.drawImage( image , 0 , 0 ) ;
	this.updateFromCanvas() ;
	this.pushHistory() ;
} ;



CanvasEditor.prototype.pushHistory = function() {
	var imageData = this.history[ ++ this.historyIndex ] = new ImageData( new Uint8ClampedArray( this.image.data ) , this.image.width , this.image.height ) ;
	this.history.length = this.historyIndex + 1 ;
	console.warn( "imagaData:" , imageData ) ;
} ;



CanvasEditor.prototype.undo = function() {
	if ( this.historyIndex <= 0 ) { return false ; }
	this.image.data.set( this.history[ -- this.historyIndex ].data ) ;
	this.ctx.putImageData( this.image , 0 , 0 ) ;
	return true ;
} ;



CanvasEditor.prototype.redo = function() {
	if ( this.historyIndex >= this.history.length - 1 ) { return false ; }
	this.image.data.set( this.history[ ++ this.historyIndex ].data ) ;
	this.ctx.putImageData( this.image , 0 , 0 ) ;
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



CanvasEditor.prototype.fromTextureCoordinates = function( position ) {
	position.x = position.x * this.ctx.canvas.width ;
	position.y = ( 1 - position.y ) * this.ctx.canvas.height ;
} ;



CanvasEditor.prototype.draw = function( position , fromTexCoord = false ) {
	if ( fromTexCoord ) { this.fromTextureCoordinates( position ) ; }

	console.warn( "new position:" , position ) ;
	
	this.color.a = Math.round( 255 * this.brushOpacity ) ;

	// Draw the disc
	if ( ! this.lastDrawAt ) {
		this.drawWindow.xMin = Math.max( 0 , Math.floor( position.x - this.brushRadius ) ) ;
		this.drawWindow.xMax = Math.min( this.ctx.canvas.width - 1 , Math.ceil( position.x + this.brushRadius ) ) ;
		this.drawWindow.yMin = Math.max( 0 , Math.floor( position.y - this.brushRadius ) ) ;
		this.drawWindow.yMax = Math.min( this.ctx.canvas.height - 1 , Math.ceil( position.y + this.brushRadius ) ) ;

		this.drawUpdateWindow.xMin = Math.max( 0 , Math.floor( position.x - this.brushRadius ) ) ;
		this.drawUpdateWindow.xMax = Math.min( this.ctx.canvas.width - 1 , Math.ceil( position.x + this.brushRadius ) ) ;
		this.drawUpdateWindow.yMin = Math.max( 0 , Math.floor( position.y - this.brushRadius ) ) ;
		this.drawUpdateWindow.yMax = Math.min( this.ctx.canvas.height - 1 , Math.ceil( position.y + this.brushRadius ) ) ;

		this.accumulatorImageManipulator.disc( position.x , position.y , this.brushRadius * this.brushHardness , this.brushRadius , this.color ) ;
	}
	else {
		this.drawWindow.xMin = Math.min( this.drawWindow.xMin , Math.max( 0 , Math.floor( position.x - this.brushRadius ) ) ) ;
		this.drawWindow.xMax = Math.max( this.drawWindow.xMax , Math.min( this.ctx.canvas.width - 1 , Math.ceil( position.x + this.brushRadius ) ) ) ;
		this.drawWindow.yMin = Math.min( this.drawWindow.yMin , Math.max( 0 , Math.floor( position.y - this.brushRadius ) ) ) ;
		this.drawWindow.yMax = Math.max( this.drawWindow.yMax , Math.min( this.ctx.canvas.height - 1 , Math.ceil( position.y + this.brushRadius ) ) ) ;

		this.drawUpdateWindow.xMin = Math.max( 0 , Math.floor( Math.min( position.x , this.lastDrawAt.x ) - this.brushRadius ) ) ;
		this.drawUpdateWindow.xMax = Math.min( this.ctx.canvas.width - 1 , Math.ceil( Math.max( position.x , this.lastDrawAt.x ) + this.brushRadius ) ) ;
		this.drawUpdateWindow.yMin = Math.max( 0 , Math.floor( Math.min( position.y , this.lastDrawAt.y ) - this.brushRadius ) ) ;
		this.drawUpdateWindow.yMax = Math.min( this.ctx.canvas.height - 1 , Math.ceil( Math.max( position.y , this.lastDrawAt.y ) + this.brushRadius ) ) ;

		this.accumulatorImageManipulator.thickLine( this.lastDrawAt.x , this.lastDrawAt.y , position.x , position.y , this.brushRadius * this.brushHardness , this.brushRadius , this.color ) ;
	}

	this.updatePreview() ;

	this.lastDrawAt = position ;
	return true ;	// <-- something changed
} ;



CanvasEditor.prototype.finishDraw = function() {
	if ( ! this.lastDrawAt ) { return false ; }
	this.lastDrawAt = null ;

	this.applyDrawing() ;
	this.pushHistory() ;
	return true ;
} ;



CanvasEditor.prototype.updatePreview = function() {
	var rect = {
		xMin: Math.max( 0 , this.drawUpdateWindow.xMin ) ,
		xMax: Math.min( this.ctx.canvas.width - 1 , this.drawUpdateWindow.xMax ) ,
		yMin: Math.max( 0 , this.drawUpdateWindow.yMin ) ,
		yMax: Math.min( this.ctx.canvas.height - 1 , this.drawUpdateWindow.yMax )
	} ;

	//console.warn( ".updatePreview() -- draw:" , this.drawWindow , "drawUpdate:" , this.drawUpdateWindow , "rect:" , rect ) ;
	this.previewCtx.putImageData( this.accumulatorImageManipulator.object , 0 , 0 , rect.xMin , rect.yMin , rect.xMax - rect.xMin , rect.yMax - rect.yMin ) ;
} ;



CanvasEditor.prototype.applyDrawing = function() {
	this.accumulatorImageManipulator.mergeInto( this.image , this.drawWindow , true ) ;
	this.ctx.putImageData( this.image , 0 , 0 ) ;
	this.accumulatorImageManipulator.clear() ;
	this.previewCtx.clearRect( 0 , 0 , this.ctx.canvas.width , this.ctx.canvas.height ) ;
} ;



CanvasEditor.prototype.autoNormalFilter = function( inputCtx ) {
	var input = inputCtx.getImageData( 0 , 0 , inputCtx.canvas.width , inputCtx.canvas.height ) ,
		inputImage = new ImageManipulator( input ) ;
	
	//inputImage.toNormal( output ) ;

	//*
	var heightMap = inputImage.toMono().blurChannel( null , 0 , 5 ) ;
	heightMap.toNormal( this.image ) ;
	//*/
	
	this.ctx.putImageData( this.image , 0 , 0 ) ;
	this.pushHistory() ;
} ;

