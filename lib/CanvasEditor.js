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
	this.drawOpacity = 1 ;
	this.history = [] ;		// Contains ImageData
	this.historyIndex = -1 ;

	this.lastDrawAt = null ;
	this.drawWindow = { xMin: 0 , xMax: 0 , yMin: 0 , yMax: 0 } ;
	this.drawUpdateWindow = { xMin: 0 , xMax: 0 , yMin: 0 , yMax: 0 } ;
	
	this.accumulatorImage = new ImageManipulator( new ImageData( this.ctx.canvas.width , this.ctx.canvas.height ) ) ;
	
	this.previewCtx.clearRect( 0 , 0 , this.previewCtx.canvas.width , this.previewCtx.canvas.height ) ;
}

module.exports = CanvasEditor ;



CanvasEditor.prototype.setColor = function( color ) { Object.assign( this.color , color ) ; } ;
CanvasEditor.prototype.setOpacity = function( opacity ) { this.drawOpacity = Math.max( 0 , Math.min( 1 , + opacity || 0 ) ) ; } ;
CanvasEditor.prototype.setBrushRadius = function( radius ) { this.brushRadius = radius ; } ;
CanvasEditor.prototype.setBrushHardness = function( hardness ) { this.brushHardness = hardness ; } ;



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

	console.warn( "new position:" , position ) ;
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

		this.accumulatorImage.disc( position.x , position.y , this.brushRadius * this.brushHardness , this.brushRadius , this.color ) ;
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

		this.accumulatorImage.thickLine( this.lastDrawAt.x , this.lastDrawAt.y , position.x , position.y , this.brushRadius * this.brushHardness , this.brushRadius , this.color ) ;
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
	this.previewCtx.putImageData( this.accumulatorImage.object , 0 , 0 , rect.xMin , rect.yMin , rect.xMax - rect.xMin , rect.yMax - rect.yMin ) ;
} ;



CanvasEditor.prototype.applyDrawing = function() {
	//console.warn( "this.drawWindow:" , this.drawWindow ) ;
	var output = this.ctx.getImageData( 0 , 0 , this.ctx.canvas.width , this.ctx.canvas.height ) ;
	
	this.accumulatorImage.copyTo( output , this.drawWindow , true ) ;
	this.ctx.putImageData( output , 0 , 0 ) ;
	this.accumulatorImage.clear() ;
	this.previewCtx.clearRect( 0 , 0 , this.ctx.canvas.width , this.ctx.canvas.height ) ;
} ;



// DEPRECATED, but need to be ported

CanvasEditor.prototype.softAlpha = function( input , rect , radius ) {
	var x , y , offset ,
		output = new ImageData( input.width , input.height ) ;

	for ( y = rect.yMin ; y < rect.yMax ; y ++ ) {
		for ( x = rect.xMin ; x < rect.xMax ; x ++ ) {
			offset = 4 * ( y * input.width + x ) ;

			// Check if there is something visible here, if not early out
			if ( ! input.data[ offset + 3 ] ) { continue ; }

			output.data[ offset ] = input.data[ offset ] ;
			output.data[ offset + 1 ] = input.data[ offset + 1 ] ;
			output.data[ offset + 2 ] = input.data[ offset + 2 ] ;
			output.data[ offset + 3 ] = this.alphaBlurValueAt( input , x , y , radius , -255 ) ;
		}
	}

	return output ;
} ;



CanvasEditor.prototype.alphaBlurValueAt = function( input , atX , atY , radius , transparencyPenalty = 0 ) {
	var x , y , dx , dy , d2 , offset ,
		sum = 0 ,
		count = 0 ,
		radius2 = radius * radius ,
		xMin = Math.max( 0 , atX - radius ) ,
		xMax = Math.min( input.width - 1 , atX + radius ) ,
		yMin = Math.max( 0 , atY - radius ) ,
		yMax = Math.min( input.height - 1 , atY + radius ) ;
	
	for ( y = yMin ; y <= yMax ; y ++ ) {
		dy = y - atY ;

		for ( x = xMin ; x <= xMax ; x ++ ) {
			dx = x - atX ;
			d2 = dx * dx + dy * dy ;
			if ( d2 > radius2 ) { continue ; }
			count ++ ;
			//if ( x < 0 || x >= input.width || y < 0 || y >= input.height ) { continue ; }
			offset = 4 * ( y * input.width + x ) ;
			sum += input.data[ offset + 3 ] || transparencyPenalty ;
		}
	}
	
	return Math.max( 0 , Math.round( sum / count ) ) ;
} ;

