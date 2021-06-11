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



function CanvasEditor( ctx , inputCtx ) {
	this.ctx = ctx ;
	this.inputCtx = inputCtx ;
	this.colorCode = '#8080ff' ;
	this.brushRadius = 12 ;
	this.drawOpacity = 1 ;
	this.history = [] ;		// Contains ImageData
	this.historyIndex = -1 ;

	this.lastDrawAt = null ;
	this.drawWindow = { xMin: 0 , xMax: 0 , yMin: 0 , yMax: 0 } ;
	
	this.inputCtx.fillStyle = '#00000000' ;
	this.inputCtx.fillRect( 0 , 0 , this.inputCtx.canvas.width , this.inputCtx.canvas.height ) ;
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
		this.drawWindow.xMin = Math.max( 0 , position.x - this.brushRadius ) ;
		this.drawWindow.xMax = Math.min( this.ctx.canvas.width - 1 , position.x + this.brushRadius ) ;
		this.drawWindow.yMin = Math.max( 0 , position.y - this.brushRadius ) ;
		this.drawWindow.yMax = Math.min( this.ctx.canvas.height - 1 , position.y + this.brushRadius ) ;
		this.drawBrushStampAt( position ) ;
	}
	else {
		this.drawWindow.xMin = Math.min( this.drawWindow.xMin , Math.max( 0 , position.x - this.brushRadius ) ) ;
		this.drawWindow.xMax = Math.max( this.drawWindow.xMax , Math.min( this.ctx.canvas.width - 1 , position.x + this.brushRadius ) ) ;
		this.drawWindow.yMin = Math.min( this.drawWindow.yMin , Math.max( 0 , position.y - this.brushRadius ) ) ;
		this.drawWindow.yMax = Math.max( this.drawWindow.yMax , Math.min( this.ctx.canvas.height - 1 , position.y + this.brushRadius ) ) ;
		this.drawBrushLine( this.lastDrawAt , position , true ) ;
	}

	this.lastDrawAt = position ;
	return true ;	// <-- something changed
} ;



CanvasEditor.prototype.drawBrushStampAt = function( position ) {
	//var ctx = this.ctx ;
	var ctx = this.inputCtx ;

	ctx.fillStyle = this.colorCode ;
	ctx.globalAlpha = this.drawOpacity ;
	ctx.beginPath() ;
	ctx.arc( position.x , position.y , this.brushRadius , 0 , 2 * Math.PI , false ) ;
	ctx.fill() ;
} ;



CanvasEditor.prototype.drawBrushLine = function( from , to , isContinue = false ) {
	//var ctx = this.ctx ;
	var ctx = this.inputCtx ;

	ctx.fillStyle = this.colorCode ;
	ctx.globalAlpha = this.drawOpacity ;

	var angle = Math.atan2( to.y - from.y , to.x - from.x ) ,
		orthoX = Math.cos( angle + Math.PI / 2 ) ,
		orthoY = Math.sin( angle + Math.PI / 2 ) ;

	ctx.beginPath() ;
	ctx.arc( from.x , from.y , this.brushRadius , angle - Math.PI / 2 , angle + Math.PI / 2 , ! isContinue ) ;
	ctx.lineTo( to.x + orthoX * this.brushRadius , to.y + orthoY * this.brushRadius ) ;
	ctx.arc( to.x , to.y , this.brushRadius , angle + Math.PI / 2 , angle - Math.PI / 2 , true ) ;
	ctx.lineTo( from.x - orthoX * this.brushRadius , from.y - orthoY * this.brushRadius ) ;
	ctx.fill() ;
} ;



CanvasEditor.prototype.finishDraw = function() {
	if ( ! this.lastDrawAt ) { return false ; }
	this.lastDrawAt = null ;

	this.applyDrawing() ;
	this.pushHistory() ;
	return true ;
} ;



CanvasEditor.prototype.applyDrawing = function() {
	console.warn( "this.drawWindow:" , this.drawWindow ) ;
	var output = this.ctx.getImageData( 0 , 0 , this.ctx.canvas.width , this.ctx.canvas.height ) ,
		input = this.inputCtx.getImageData( 0 , 0 , this.ctx.canvas.width , this.ctx.canvas.height ) ;
	
	//input = this.softAlpha( input ) ;
	this.copyTo( input , output ) ;
	this.ctx.putImageData( output , 0 , 0 ) ;
	this.inputCtx.clearRect( 0 , 0 , this.ctx.canvas.width , this.ctx.canvas.height ) ;
} ;



CanvasEditor.prototype.copyTo = function( input , output ) {
	var x , y , offset , sr , sg , sb , sa , s1ma , dr , dg , db ;

	for ( y = this.drawWindow.yMin ; y < this.drawWindow.yMax ; y ++ ) {
		for ( x = this.drawWindow.xMin ; x < this.drawWindow.xMax ; x ++ ) {
			offset = 4 * ( y * input.height + x ) ;

			// Filter transparency out now
			sa = input.data[ offset + 3 ] / 255 ;
			if ( ! sa ) { return ; }

			sr = input.data[ offset ] ;
			sg = input.data[ offset + 1 ] ;
			sb = input.data[ offset + 2 ] ;
			s1ma = 1 - sa ;
			dr = output.data[ offset ] ;
			dg = output.data[ offset + 1 ] ;
			db = output.data[ offset + 2 ] ;
			output.data[ offset ] = Math.round( sr * sa + dr * s1ma ) ;
			output.data[ offset + 1 ] = Math.round( sg * sa + dg * s1ma ) ;
			output.data[ offset + 2 ] = Math.round( sb * sa + db * s1ma ) ;
			output.data[ offset + 3 ] = 255 ;
		}
	}

	return output ;
} ;



CanvasEditor.prototype.softAlpha = function( input ) {
	var x , y , offset ,
		output = new ImageData( input.width , input.height ) ;

	for ( y = this.drawWindow.yMin ; y < this.drawWindow.yMax ; y ++ ) {
		for ( x = this.drawWindow.xMin ; x < this.drawWindow.xMax ; x ++ ) {
			offset = 4 * ( y * input.height + x ) ;
			output.data[ offset + 3 ] = this.alphaBlurValueAt( input , x , y , 1 ) ;
		}
	}

	return output ;
} ;



CanvasEditor.prototype.alphaBlurValueAt = function( input , atX , atY , radius ) {
	var x , y , dx , dy , d2 , offset ,
		sum = 0 ,
		count = 0 ,
		radius2 = radius * radius ,
		xMin = atX - radius ,
		xMax = atX + radius ,
		yMin = atY - radius ,
		yMax = atY + radius ;
	
	for ( y = yMin ; y <= yMax ; y ++ ) {
		dy = y - atY ;

		for ( x = xMin ; x <= xMax ; x ++ ) {
			dx = x - atX ;
			d2 = dx * dx + dy * dy ;
			if ( d2 > radius2 ) { continue ; }
			count ++ ;
			if ( x < 0 || x >= input.width || y < 0 || y >= input.height ) { continue ; }
			offset = 4 * ( y * input.height + x ) ;
			sum += input.data[ offset + 3 ] ;
		}
	}
	
	return Math.round( sum / count ) ;
} ;

