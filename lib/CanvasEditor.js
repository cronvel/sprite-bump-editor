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



function CanvasEditor( ctx , previewCtx , mask = null ) {
	this.ctx = ctx ;
	this.previewCtx = previewCtx ;
	this.mask = mask ;	// This is another CanvasEditor used as a mask for this one
	this.brushColor = { r: 128 , g: 128 , b: 255 , a: 255 } ;
	this.brushRadius = 12 ;
	this.brushHardness = 0.5 ;
	this.brushOpacity = 1 ;
	this.history = [] ;		// Contains ImageData
	this.historyIndex = -1 ;

	this.lastDrawAt = null ;
	this.drawWindow = { xMin: 0 , xMax: 0 , yMin: 0 , yMax: 0 } ;
	this.drawUpdateWindow = { xMin: 0 , xMax: 0 , yMin: 0 , yMax: 0 } ;
	
	this.polygonPoints = [] ;	// Coordinates of the current point of the polygon to be traced
	
	this.image = null ;
	this.accumulatorImageManipulator = new ImageManipulator( new ImageData( this.ctx.canvas.width , this.ctx.canvas.height ) ) ;
	
	this.meta = {} ;	// Some metadata to store for external usage
	
	this.previewCtx.clearRect( 0 , 0 , this.previewCtx.canvas.width , this.previewCtx.canvas.height ) ;
}

module.exports = CanvasEditor ;



CanvasEditor.prototype.setBrushColor = function( color ) { Object.assign( this.brushColor , color ) ; } ;
CanvasEditor.prototype.setBrushOpacity = function( opacity ) { this.brushOpacity = Math.max( 0 , Math.min( 1 , + opacity || 0 ) ) ; } ;
CanvasEditor.prototype.setBrushRadius = function( radius ) { this.brushRadius = radius ; } ;
CanvasEditor.prototype.setBrushHardness = function( hardness ) { this.brushHardness = hardness ; } ;

CanvasEditor.prototype.setBrush = function( params ) {
	if ( params.color ) { this.setBrushColor( params.color ) ; }
	if ( params.opacity ) { this.setBrushOpacity( params.opacity ) ; }
	if ( params.radius ) { this.setBrushRadius( params.radius ) ; }
	if ( params.hardness ) { this.setBrushHardness( params.hardness ) ; }
} ;



// Update the image, do it if the canvas was modified (e.g.: loading a texture)
CanvasEditor.prototype.updateFromCanvas = function() {
	this.image = this.ctx.getImageData( 0 , 0 , this.ctx.canvas.width , this.ctx.canvas.height ) ;
} ;

CanvasEditor.prototype.setImage = function( image ) {
	this.ctx.drawImage( image , 0 , 0 ) ;
	this.updateFromCanvas() ;
	this.pushHistory() ;
} ;

CanvasEditor.prototype.clear = function( pushHistory = true ) {
	new ImageManipulator( this.image ).clear() ;
	this.ctx.putImageData( this.image , 0 , 0 ) ;
	if ( pushHistory ) { this.pushHistory() ; }
} ;

CanvasEditor.prototype.clearWhite = function( pushHistory = true ) {
	new ImageManipulator( this.image ).clearWhite() ;
	this.ctx.putImageData( this.image , 0 , 0 ) ;
	if ( pushHistory ) { this.pushHistory() ; }
} ;

CanvasEditor.prototype.clearOpaqueBlack = function( pushHistory = true ) {
	new ImageManipulator( this.image ).clearOpaqueBlack() ;
	this.ctx.putImageData( this.image , 0 , 0 ) ;
	if ( pushHistory ) { this.pushHistory() ; }
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



CanvasEditor.prototype.getMaskImageManipulator = function() {
	if ( ! this.mask || ! this.mask.meta.isActiveMask || ! this.mask.image ) { return null ; }
	return new ImageManipulator( this.mask.image ) ;
} ;



CanvasEditor.prototype.draw = function( position , fromTexCoord = false ) {
	if ( fromTexCoord ) { this.fromTextureCoordinates( position ) ; }

	console.warn( "new draw position:" , position ) ;
	
	this.brushColor.a = Math.round( 255 * this.brushOpacity ) ;

	if ( ! this.lastDrawAt ) {
		// Draw the disc
		this.drawWindow.xMin = Math.max( 0 , Math.floor( position.x - this.brushRadius ) ) ;
		this.drawWindow.xMax = Math.min( this.ctx.canvas.width - 1 , Math.ceil( position.x + this.brushRadius ) ) ;
		this.drawWindow.yMin = Math.max( 0 , Math.floor( position.y - this.brushRadius ) ) ;
		this.drawWindow.yMax = Math.min( this.ctx.canvas.height - 1 , Math.ceil( position.y + this.brushRadius ) ) ;

		this.drawUpdateWindow.xMin = Math.max( 0 , Math.floor( position.x - this.brushRadius ) ) ;
		this.drawUpdateWindow.xMax = Math.min( this.ctx.canvas.width - 1 , Math.ceil( position.x + this.brushRadius ) ) ;
		this.drawUpdateWindow.yMin = Math.max( 0 , Math.floor( position.y - this.brushRadius ) ) ;
		this.drawUpdateWindow.yMax = Math.min( this.ctx.canvas.height - 1 , Math.ceil( position.y + this.brushRadius ) ) ;

		this.accumulatorImageManipulator.disc(
			position.x , position.y ,
			this.brushRadius * this.brushHardness ,
			this.brushRadius ,
			this.brushColor ,
			this.getMaskImageManipulator()
		) ;
	}
	else {
		// Draw a thick line
		this.drawWindow.xMin = Math.min( this.drawWindow.xMin , Math.max( 0 , Math.floor( position.x - this.brushRadius ) ) ) ;
		this.drawWindow.xMax = Math.max( this.drawWindow.xMax , Math.min( this.ctx.canvas.width - 1 , Math.ceil( position.x + this.brushRadius ) ) ) ;
		this.drawWindow.yMin = Math.min( this.drawWindow.yMin , Math.max( 0 , Math.floor( position.y - this.brushRadius ) ) ) ;
		this.drawWindow.yMax = Math.max( this.drawWindow.yMax , Math.min( this.ctx.canvas.height - 1 , Math.ceil( position.y + this.brushRadius ) ) ) ;

		this.drawUpdateWindow.xMin = Math.max( 0 , Math.floor( Math.min( position.x , this.lastDrawAt.x ) - this.brushRadius ) ) ;
		this.drawUpdateWindow.xMax = Math.min( this.ctx.canvas.width - 1 , Math.ceil( Math.max( position.x , this.lastDrawAt.x ) + this.brushRadius ) ) ;
		this.drawUpdateWindow.yMin = Math.max( 0 , Math.floor( Math.min( position.y , this.lastDrawAt.y ) - this.brushRadius ) ) ;
		this.drawUpdateWindow.yMax = Math.min( this.ctx.canvas.height - 1 , Math.ceil( Math.max( position.y , this.lastDrawAt.y ) + this.brushRadius ) ) ;

		this.accumulatorImageManipulator.thickLine(
			this.lastDrawAt.x , this.lastDrawAt.y ,
			position.x , position.y ,
			this.brushRadius * this.brushHardness ,
			this.brushRadius ,
			this.brushColor ,
			this.getMaskImageManipulator()
		) ;
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



CanvasEditor.prototype.applyDrawing = function() {
	this.accumulatorImageManipulator.mergeInto( this.image , this.drawWindow , true ) ;
	this.ctx.putImageData( this.image , 0 , 0 ) ;
	this.accumulatorImageManipulator.clear() ;
	this.previewCtx.clearRect( 0 , 0 , this.ctx.canvas.width , this.ctx.canvas.height ) ;
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



CanvasEditor.prototype.addPolygonPoint = function( position , fromTexCoord = false ) {
	if ( fromTexCoord ) { this.fromTextureCoordinates( position ) ; }

	console.warn( "new Polygon Point position:" , position ) ;
	this.polygonPoints.push( position ) ;
	this.updatePolygonPreview( this.lastDrawAt , position ) ;
	return true ;	// <-- something changed
} ;



CanvasEditor.prototype.finishPolygon = function() {
	this.applyPolygon() ;
	this.polygonPoints.length = 0 ;
} ;



CanvasEditor.prototype.applyPolygon = function() {
	var i , dot ,
		ctx = this.ctx ;

	if ( this.polygonPoints.length < 2 ) { return ; }

	ctx.beginPath() ;
	dot = this.polygonPoints[ 0 ] ;
	ctx.moveTo( dot.x , dot.y ) ;

	for ( i = 1 ; i < this.polygonPoints.length ; i ++ ) {
		dot = this.polygonPoints[ i ] ;
		ctx.lineTo( dot.x , dot.y ) ;
	}

	ctx.closePath() ;
	ctx.fillStyle = '#ffffffff';
	ctx.fill() ;

	this.previewCtx.clearRect( 0 , 0 , this.ctx.canvas.width , this.ctx.canvas.height ) ;
	this.updateFromCanvas() ;
} ;



CanvasEditor.prototype.updatePolygonPreview = function() {
	var from , to ,
		ctx = this.previewCtx ;

	if ( ! this.polygonPoints.length ) { return ; }

	if ( this.polygonPoints.length === 1 ) {
		to = this.polygonPoints[ this.polygonPoints.length - 1 ] ;
		ctx.beginPath() ;
		ctx.ellipse( to.x , to.y , 5 , 5 , 0 , 0 , 2 * Math.PI ) ;
		ctx.stroke() ;
	}
	else {
		from = this.polygonPoints[ this.polygonPoints.length - 2 ] ;
		to = this.polygonPoints[ this.polygonPoints.length - 1 ] ;

		ctx.beginPath() ;
		ctx.moveTo( from.x , from.y ) ;
		ctx.lineTo( to.x , to.y ) ;
		ctx.stroke() ;
	}
} ;



CanvasEditor.prototype.luminosityHeightMapFilter = function( inputCtx ) {
	var input = inputCtx.getImageData( 0 , 0 , inputCtx.canvas.width , inputCtx.canvas.height ) ,
		inputImage = new ImageManipulator( input ) ,
		mask = this.getMaskImageManipulator() ,
		area = mask ? { mask } : null ;

	inputImage.toMono( this.image , area ) ;
	this.ctx.putImageData( this.image , 0 , 0 ) ;
	this.pushHistory() ;
} ;



CanvasEditor.prototype.alphaHeightMapFilter = function( inputCtx ) {
	var input = inputCtx.getImageData( 0 , 0 , inputCtx.canvas.width , inputCtx.canvas.height ) ,
		inputImage = new ImageManipulator( input ) ,
		mask = this.getMaskImageManipulator() ,
		area = mask ? { mask } : null ;

	inputImage.alphaToMono( this.image , area ) ;
	this.ctx.putImageData( this.image , 0 , 0 ) ;
	this.pushHistory() ;
} ;



CanvasEditor.prototype.alphaEmbossHeightMapFilter = function( inputCtx , params = {} ) {
	var input = inputCtx.getImageData( 0 , 0 , inputCtx.canvas.width , inputCtx.canvas.height ) ,
		inputImage = new ImageManipulator( input ) ,
		undersampling = Math.round( + params.undersampling || 1 ) ,
		embossParams = { radius: params.radius , transform: params.transform } ,
		mask = this.getMaskImageManipulator() ,
		area = mask ? { mask } : null ;
	
	if ( undersampling > 1 ) {
		let scaledMask = mask.scaleBilinear( null , 1 / undersampling ) ,
			scaledArea = { mask: scaledMask } ;

		inputImage.scaleBilinear( null , 1 / undersampling )
			.alphaToMono()
			.emboss( null , scaledArea , embossParams )
			.scaleBilinear( null , undersampling )
			.toMono( this.image , area ) ;
	}
	else {
		inputImage.alphaToMono()
			.emboss( null , area , embossParams )
			.toMono( this.image , area ) ;
	}

	this.ctx.putImageData( this.image , 0 , 0 ) ;
	this.pushHistory() ;
} ;



CanvasEditor.prototype.heightMapToNormalFilter = function( inputCtx , params = {} ) {
	var input = inputCtx.getImageData( 0 , 0 , inputCtx.canvas.width , inputCtx.canvas.height ) ,
		inputImage = new ImageManipulator( input ) ,
		mask = this.getMaskImageManipulator() ,
		area = mask ? { mask } : null ;
	
	inputImage.toMono()
		.heightMapToNormal( null , area , { height: params.intensity * 10 } )
		.blur( null , area , { radius: 2 } )
		.copyTo( this.image , area ) ;
	this.ctx.putImageData( this.image , 0 , 0 ) ;
	this.pushHistory() ;
} ;



CanvasEditor.prototype.monoFilter = function() {
	var inputImage = new ImageManipulator( this.image ) ,
		mask = this.getMaskImageManipulator() ,
		area = mask ? { mask } : null ;

	inputImage.toMono( this.image , area ) ;
	this.ctx.putImageData( this.image , 0 , 0 ) ;
	this.pushHistory() ;
} ;



CanvasEditor.prototype.blurFilter = function( params = {} ) {
	var inputImage = new ImageManipulator( this.image ) ,
		blurParams = { radius: params.radius , erosion: !! params.erosion } ,
		mask = this.getMaskImageManipulator() ,
		area = mask ? { mask } : null ;

	if ( params.iteration ) {
		for ( let i = params.iteration - 1 ; i > 0 ; i -- ) {
			inputImage = inputImage.blur( null , area , blurParams ) ;
		}
	}

	inputImage.blur( this.image , area , blurParams ) ;

	this.ctx.putImageData( this.image , 0 , 0 ) ;
	this.pushHistory() ;
} ;



CanvasEditor.prototype.monoBlurFilter = function( params = {} ) {
	var inputImage = new ImageManipulator( this.image ) ,
		mask = this.getMaskImageManipulator() ,
		area = mask ? { mask } : null ;

	inputImage = inputImage.toMono()

	if ( params.iteration ) {
		for ( let i = params.iteration - 1 ; i > 0 ; i -- ) {
			inputImage = inputImage.blur( null , area , { radius: params.radius } ) ;
		}
	}

	inputImage.blur( null , area , { radius: params.radius } )
		.toMono( this.image ) ;

	this.ctx.putImageData( this.image , 0 , 0 ) ;
	this.pushHistory() ;
} ;



CanvasEditor.prototype.fastBlurFilter = function( params = {} ) {
	var inputImage = new ImageManipulator( this.image ) ,
		mask = this.getMaskImageManipulator() ,
		area = mask ? { mask } : null ;

	inputImage.horizontalBlur( null , area , { radius: params.radius } )
		.verticalBlur( this.image , area , { radius: params.radius } ) ;

	this.ctx.putImageData( this.image , 0 , 0 ) ;
	this.pushHistory() ;
} ;



CanvasEditor.prototype.horizontalBlurFilter = function( params = {} ) {
	var inputImage = new ImageManipulator( this.image ) ,
		mask = this.getMaskImageManipulator() ,
		area = mask ? { mask } : null ;

	inputImage.horizontalBlur( this.image , area , { radius: params.radius } ) ;

	this.ctx.putImageData( this.image , 0 , 0 ) ;
	this.pushHistory() ;
} ;



CanvasEditor.prototype.verticalBlurFilter = function( params = {} ) {
	var inputImage = new ImageManipulator( this.image ) ,
		mask = this.getMaskImageManipulator() ,
		area = mask ? { mask } : null ;

	inputImage.verticalBlur( this.image , area , { radius: params.radius } ) ;

	this.ctx.putImageData( this.image , 0 , 0 ) ;
	this.pushHistory() ;
} ;

