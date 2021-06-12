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



const helpers = require( './helpers.js' ) ;
const electronHelpers = require( './electronHelpers.js' ) ;
const Promise = require( 'seventh' ) ;



function CanvasEditor( ctx , previewCtx , inputCtx ) {
	this.ctx = ctx ;
	this.previewCtx = previewCtx ;
	this.inputCtx = inputCtx ;
	this.colorCode = '#8080ff' ;
	this.brushRadius = 12 ;
	this.brushBlurRadius = 10 ;
	this.drawOpacity = 1 ;
	this.history = [] ;		// Contains ImageData
	this.historyIndex = -1 ;

	this.lastDrawAt = null ;
	this.drawWindow = { xMin: 0 , xMax: 0 , yMin: 0 , yMax: 0 } ;
	this.drawUpdateWindow = { xMin: 0 , xMax: 0 , yMin: 0 , yMax: 0 } ;
	
	this.inputCtx.fillStyle = '#00000000' ;
	this.inputCtx.fillRect( 0 , 0 , this.inputCtx.canvas.width , this.inputCtx.canvas.height ) ;
	this.previewCtx.fillStyle = '#00000000' ;
	this.previewCtx.fillRect( 0 , 0 , this.previewCtx.canvas.width , this.previewCtx.canvas.height ) ;
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

		this.drawBrushDot( position ) ;
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

		this.drawBrushLine( this.lastDrawAt , position , true ) ;
	}

	this.lastDrawAt = position ;
	return true ;	// <-- something changed
} ;



CanvasEditor.prototype.drawBrushDot = function( position ) {
	//var ctx = this.ctx ;
	var ctx = this.inputCtx ;

	ctx.fillStyle = this.colorCode ;
	ctx.globalAlpha = this.drawOpacity ;
	ctx.beginPath() ;
	ctx.arc( position.x , position.y , this.brushRadius , 0 , 2 * Math.PI , false ) ;
	ctx.fill() ;

	this.compose() ;
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

	this.compose() ;
} ;



CanvasEditor.prototype.finishDraw = function() {
	if ( ! this.lastDrawAt ) { return false ; }
	this.lastDrawAt = null ;

	this.applyDrawing() ;
	this.pushHistory() ;
	return true ;
} ;

/*
	/!\ Refacto /!\
	* Remove the inputCtx
	* Use only a imageData (accumulator) to store current draw, don't use canvas primitives, that don't support soft brush
	* There is a hard radius (HR) and a soft radius (SR)
	* To draw brush dot, iterate rect pixels and find distance to center D, if D < HR, draw the color with alpha 1,
		if D > SR skip the pixel (alpha 0), id HR < D < SR draw the color with progressive alpha
	* To draw brush line, find the line equation ax+by=0 from the vector, then normalize (a,b), this new |ax+by| expression
		give the distance to the line, we can use the same algo than brush dot to treat hard/soft radius.
		The cap limit can be computed using the same normalized equation for the "médiatrice" of the segment.
	* When drawing into the accumulator, we overwrite only if we have a the higher alpha
	* Copy it to the previewCtx while drawing, apply it on the real ctx on finish
*/

CanvasEditor.prototype.compose = function() {
	var areaOfEffect = this.brushBlurRadius ;
	areaOfEffect = 100 ;

	var rect = {
		xMin: Math.max( 0 , this.drawUpdateWindow.xMin - areaOfEffect ) ,
		xMax: Math.min( this.ctx.canvas.width - 1 , this.drawUpdateWindow.xMax + areaOfEffect ) ,
		yMin: Math.max( 0 , this.drawUpdateWindow.yMin - areaOfEffect ) ,
		yMax: Math.min( this.ctx.canvas.height - 1 , this.drawUpdateWindow.yMax + areaOfEffect )
	} ;

	var input = this.inputCtx.getImageData( rect.xMin , rect.yMin , rect.xMax - rect.xMin + 1 , rect.yMax - rect.yMin + 1 ) ,
		output = this.previewCtx.getImageData( rect.xMin , rect.yMin , rect.xMax - rect.xMin + 1 , rect.yMax - rect.yMin + 1 ) ;

	console.warn( "draw:" , this.drawWindow , "drawUpdate:" , this.drawUpdateWindow , "rect:" , rect ) ;
	console.warn( "input:" , input.width , input.height ) ;
	console.warn( "output:" , output.width , output.height ) ;
	
	var rebasedRect = helpers.rebaseRect( rect , rect.xMin , rect.yMin ) ;

	input = this.softAlpha( input , rebasedRect , this.brushBlurRadius ) ;
	this.copyTo( input , output , rebasedRect , false ) ;
	this.previewCtx.putImageData( output , rect.xMin , rect.yMin ) ;
} ;



CanvasEditor.prototype.applyDrawing = function() {
	console.warn( "this.drawWindow:" , this.drawWindow ) ;
	var input = this.previewCtx.getImageData( 0 , 0 , this.ctx.canvas.width , this.ctx.canvas.height ) ,
		output = this.ctx.getImageData( 0 , 0 , this.ctx.canvas.width , this.ctx.canvas.height ) ;
	
	this.copyTo( input , output , this.drawWindow , true ) ;
	this.ctx.putImageData( output , 0 , 0 ) ;
	this.previewCtx.clearRect( 0 , 0 , this.ctx.canvas.width , this.ctx.canvas.height ) ;
	this.inputCtx.clearRect( 0 , 0 , this.ctx.canvas.width , this.ctx.canvas.height ) ;
} ;



CanvasEditor.prototype.copyTo = function( input , output , rect , forceOpaque = false ) {
	var x , y , offset , inputR , inputG , inputB , inputA , inputInvA , outputR , outputG , outputB , outputA ;

	for ( y = rect.yMin ; y < rect.yMax ; y ++ ) {
		for ( x = rect.xMin ; x < rect.xMax ; x ++ ) {
			offset = 4 * ( y * input.width + x ) ;

			// Filter transparency out now
			inputA = input.data[ offset + 3 ] / 255 ;
			if ( ! inputA ) { continue ; }

			inputR = input.data[ offset ] ;
			inputG = input.data[ offset + 1 ] ;
			inputB = input.data[ offset + 2 ] ;
			if ( ! inputR && ! inputG && ! inputB ) { continue ; }
			inputInvA = 1 - inputA ;
			outputR = output.data[ offset ] ;
			outputG = output.data[ offset + 1 ] ;
			outputB = output.data[ offset + 2 ] ;
			output.data[ offset ] = Math.round( inputR * inputA + outputR * inputInvA ) ;
			output.data[ offset + 1 ] = Math.round( inputG * inputA + outputG * inputInvA ) ;
			output.data[ offset + 2 ] = Math.round( inputB * inputA + outputB * inputInvA ) ;

			if ( forceOpaque ) {
				output.data[ offset + 3 ] = 255 ;
			}
			else {
				//outputA = output.data[ offset + 3 ] / 255 ;
				//output.data[ offset + 3 ] = Math.round( 255 * helpers.multiplyInvAlpha( inputA , outputA ) ) ;
				output.data[ offset + 3 ] = input.data[ offset + 3 ] ;
			}
		}
	}

	return output ;
} ;



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
			if ( x < 0 || x >= input.width || y < 0 || y >= input.height ) { continue ; }
			offset = 4 * ( y * input.width + x ) ;
			sum += input.data[ offset + 3 ] || transparencyPenalty ;
		}
	}
	
	return Math.max( 0 , Math.round( sum / count ) ) ;
} ;



// DEPRECATED

CanvasEditor.prototype.applyDrawing_old = function() {
	console.warn( "this.drawWindow:" , this.drawWindow ) ;
	var output = this.ctx.getImageData( 0 , 0 , this.ctx.canvas.width , this.ctx.canvas.height ) ,
		input = this.inputCtx.getImageData( 0 , 0 , this.ctx.canvas.width , this.ctx.canvas.height ) ;
	
	input = this.softAlpha( input , this.drawWindow , this.brushBlurRadius ) ;
	this.copyTo( input , output , this.drawWindow , true ) ;
	this.ctx.putImageData( output , 0 , 0 ) ;
	this.inputCtx.clearRect( 0 , 0 , this.ctx.canvas.width , this.ctx.canvas.height ) ;
} ;

