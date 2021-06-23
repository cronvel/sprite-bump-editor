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



function CanvasEditor( ctx , previewCtx , mask = null , channels = ImageManipulator.channels.RGBA ) {
	this.ctx = ctx ;
	this.previewCtx = previewCtx ;
	this.mask = mask ;	// This is another CanvasEditor used as a mask for this one
	this.toolColor = {
		r: 128 , g: 128 , b: 255 , a: 255
	} ;
	this.toolRadius = 12 ;
	this.toolOpacity = 1 ;
	this.toolHardness = 0.5 ;
	this.toolTolerance = 0.1 ;
	this.history = [] ;		// Contains ImageData
	this.historyIndex = -1 ;

	this.lastDrawAt = null ;
	this.drawWindow = {
		xMin: 0 , xMax: 0 , yMin: 0 , yMax: 0
	} ;
	this.drawUpdateWindow = {
		xMin: 0 , xMax: 0 , yMin: 0 , yMax: 0
	} ;

	this.polygonPoints = [] ;	// Coordinates of the current point of the polygon to be traced

	this.meta = {} ;	// Some metadata to store for external usage

	this.imageData = null ;		// Always RGBA, it's an ImageData
	this.canvasImageManipulator = null ;	// created by canvas' ImageData

	this.channels = channels ;	// Internal channels, .imageManipulator will be stored using those channels
	this.isRGBA = ImageManipulator.areSameChannels( this.channels , ImageManipulator.channels.RGBA ) ;
	this.imageManipulator = null ;	// created using the real channels

	this.canvasPreviewImageManipulator = new ImageManipulator( new ImageData( this.ctx.canvas.width , this.ctx.canvas.height ) ) ;
	this.previewCtx.clearRect( 0 , 0 , this.previewCtx.canvas.width , this.previewCtx.canvas.height ) ;

	this.accumulatorImageManipulator = this.isRGBA ? this.canvasPreviewImageManipulator :
		this.channels.includes( 'alpha' ) ? new ImageManipulator( null , this.ctx.canvas.width , this.ctx.canvas.height , this.channels ) :
		new ImageManipulator( null , this.ctx.canvas.width , this.ctx.canvas.height , this.channels.concat( 'alpha' ) ) ;
}

module.exports = CanvasEditor ;

// Forward channels definition
CanvasEditor.channels = ImageManipulator.channels ;

CanvasEditor.prototype.setToolColor = function( color ) { Object.assign( this.toolColor , color ) ; } ;
CanvasEditor.prototype.setToolOpacity = function( opacity ) { this.toolOpacity = Math.max( 0 , Math.min( 1 , + opacity || 0 ) ) ; } ;
CanvasEditor.prototype.setToolRadius = function( radius ) { this.toolRadius = radius ; } ;
CanvasEditor.prototype.setToolHardness = function( hardness ) { this.toolHardness = hardness ; } ;
CanvasEditor.prototype.setToolTolerance = function( tolerance ) { this.toolTolerance = tolerance ; } ;

CanvasEditor.prototype.setTool = function( params ) {
	if ( params.color ) { this.setToolColor( params.color ) ; }
	if ( params.opacity ) { this.setToolOpacity( params.opacity ) ; }
	if ( params.radius ) { this.setToolRadius( params.radius ) ; }
	if ( params.hardness ) { this.setToolHardness( params.hardness ) ; }
	if ( params.tolerance ) { this.setToolTolerance( params.tolerance ) ; }
} ;



// Update the image, do it if the canvas was modified (e.g.: loading a texture)
CanvasEditor.prototype.updateFromCanvas = function() {
	this.imageData = this.ctx.getImageData( 0 , 0 , this.ctx.canvas.width , this.ctx.canvas.height ) ;
	this.canvasImageManipulator = new ImageManipulator( this.imageData ) ;

	if ( this.isRGBA ) {
		this.imageManipulator = this.canvasImageManipulator ;
	}
	else {
		this.imageManipulator = new ImageManipulator( null , this.imageData.width , this.imageData.height , this.channels ) ;
		this.canvasImageManipulator.compatibleCopyTo( this.imageManipulator ) ;
	}
} ;

// Update the image, do it if the canvas was modified (e.g.: loading a texture)
CanvasEditor.prototype.updateToCanvas = function() {
	// No need to copy to .imageData because it shares the same buffer than .canvasImageManipulator
	if ( this.imageManipulator !== this.canvasImageManipulator ) {
		this.imageManipulator.compatibleCopyTo( this.canvasImageManipulator ) ;
	}
	this.ctx.putImageData( this.imageData , 0 , 0 ) ;
} ;

// Update the image, do it if the canvas was modified (e.g.: loading a texture)
CanvasEditor.prototype.updatePreviewFromCanvas = function() {
	var imageData = this.previewCtx.getImageData( 0 , 0 , this.previewCtx.canvas.width , this.previewCtx.canvas.height ) ;
	this.canvasPreviewImageManipulator = new ImageManipulator( imageData ) ;

	if ( this.isRGBA ) {
		this.accumulatorImageManipulator = this.canvasPreviewImageManipulator ;
	}
	else {
		this.accumulatorImageManipulator = new ImageManipulator( null , imageData.width , imageData.height , this.channels ) ;
		this.canvasPreviewImageManipulator.compatibleCopyTo( this.accumulatorImageManipulator ) ;
	}
} ;

CanvasEditor.prototype.setImage = function( image ) {
	this.ctx.drawImage( image , 0 , 0 ) ;
	this.updateFromCanvas() ;
	this.pushHistory() ;
} ;

CanvasEditor.prototype.clear = function( pushHistory = true ) {
	this.imageManipulator.clear() ;
	this.updateToCanvas() ;
	if ( pushHistory ) { this.pushHistory() ; }
} ;

CanvasEditor.prototype.clearWhite = function( pushHistory = true ) {
	this.imageManipulator.clearWhite() ;
	this.updateToCanvas() ;
	if ( pushHistory ) { this.pushHistory() ; }
} ;

CanvasEditor.prototype.clearOpaqueBlack = function( pushHistory = true ) {
	this.imageManipulator.clearOpaqueBlack() ;
	this.updateToCanvas() ;
	if ( pushHistory ) { this.pushHistory() ; }
} ;



CanvasEditor.prototype.pushHistory = function() {
	this.history[ ++ this.historyIndex ] = this.imageManipulator.cloneData() ;
	this.history.length = this.historyIndex + 1 ;
} ;



CanvasEditor.prototype.undo = function() {
	if ( this.historyIndex <= 0 ) { return false ; }
	this.imageManipulator.setData( this.history[ -- this.historyIndex ] ) ;
	this.updateToCanvas() ;
	return true ;
} ;



CanvasEditor.prototype.redo = function() {
	if ( this.historyIndex >= this.history.length - 1 ) { return false ; }
	this.imageManipulator.setData( this.history[ ++ this.historyIndex ] ) ;
	this.updateToCanvas() ;
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
	return this.mask?.meta.isActiveMask && this.mask.imageManipulator ;
} ;



CanvasEditor.prototype.draw = function( position , fromTexCoord = false , effect = null ) {
	if ( fromTexCoord ) { this.fromTextureCoordinates( position ) ; }
	//console.warn( "new draw position:" , position , !! this.lastDrawAt ) ;
	
	if ( effect ) {
		let source = this.imageManipulator ;
		switch ( effect.type ) {
			case 'blur' :
				effect.fn = source.blurEffect ;
				effect.source = source ;
				effect.radius = effect.radius || 5 ;
				effect.clamp = !! effect.clamp ;
				break ;
			default :
				effect = null ;
				break ;
		}
	}

	this.toolColor.a = Math.round( 255 * this.toolOpacity ) ;

	if ( ! this.lastDrawAt ) {
		// Draw the disc
		this.drawWindow.xMin = Math.max( 0 , Math.floor( position.x - this.toolRadius ) ) ;
		this.drawWindow.xMax = Math.min( this.ctx.canvas.width - 1 , Math.ceil( position.x + this.toolRadius ) ) ;
		this.drawWindow.yMin = Math.max( 0 , Math.floor( position.y - this.toolRadius ) ) ;
		this.drawWindow.yMax = Math.min( this.ctx.canvas.height - 1 , Math.ceil( position.y + this.toolRadius ) ) ;

		this.drawUpdateWindow.xMin = Math.max( 0 , Math.floor( position.x - this.toolRadius ) ) ;
		this.drawUpdateWindow.xMax = Math.min( this.ctx.canvas.width - 1 , Math.ceil( position.x + this.toolRadius ) ) ;
		this.drawUpdateWindow.yMin = Math.max( 0 , Math.floor( position.y - this.toolRadius ) ) ;
		this.drawUpdateWindow.yMax = Math.min( this.ctx.canvas.height - 1 , Math.ceil( position.y + this.toolRadius ) ) ;

		this.accumulatorImageManipulator.disc(
			position.x , position.y ,
			this.toolRadius * this.toolHardness ,
			this.toolRadius ,
			this.toolColor ,
			this.getMaskImageManipulator() ,
			effect
		) ;
	}
	else {
		// Draw a thick line
		this.drawWindow.xMin = Math.min( this.drawWindow.xMin , Math.max( 0 , Math.floor( position.x - this.toolRadius ) ) ) ;
		this.drawWindow.xMax = Math.max( this.drawWindow.xMax , Math.min( this.ctx.canvas.width - 1 , Math.ceil( position.x + this.toolRadius ) ) ) ;
		this.drawWindow.yMin = Math.min( this.drawWindow.yMin , Math.max( 0 , Math.floor( position.y - this.toolRadius ) ) ) ;
		this.drawWindow.yMax = Math.max( this.drawWindow.yMax , Math.min( this.ctx.canvas.height - 1 , Math.ceil( position.y + this.toolRadius ) ) ) ;

		this.drawUpdateWindow.xMin = Math.max( 0 , Math.floor( Math.min( position.x , this.lastDrawAt.x ) - this.toolRadius ) ) ;
		this.drawUpdateWindow.xMax = Math.min( this.ctx.canvas.width - 1 , Math.ceil( Math.max( position.x , this.lastDrawAt.x ) + this.toolRadius ) ) ;
		this.drawUpdateWindow.yMin = Math.max( 0 , Math.floor( Math.min( position.y , this.lastDrawAt.y ) - this.toolRadius ) ) ;
		this.drawUpdateWindow.yMax = Math.min( this.ctx.canvas.height - 1 , Math.ceil( Math.max( position.y , this.lastDrawAt.y ) + this.toolRadius ) ) ;

		this.accumulatorImageManipulator.thickLine(
			this.lastDrawAt.x , this.lastDrawAt.y ,
			position.x , position.y ,
			this.toolRadius * this.toolHardness ,
			this.toolRadius ,
			this.toolColor ,
			this.getMaskImageManipulator() ,
			effect
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
	this.applyAccumulator( this.drawWindow ) ;
	if ( this.canvasPreviewImageManipulator !== this.accumulatorImageManipulator ) {
		this.canvasPreviewImageManipulator.clear() ;
	}
	this.previewCtx.clearRect( 0 , 0 , this.ctx.canvas.width , this.ctx.canvas.height ) ;
} ;



CanvasEditor.prototype.applyAccumulator = function( area = null ) {
	this.accumulatorImageManipulator.mergeInto( this.imageManipulator , area , true ) ;
	this.updateToCanvas() ;
	this.accumulatorImageManipulator.clear() ;
} ;



CanvasEditor.prototype.updatePreview = function() {
	var rect = {
		xMin: Math.max( 0 , this.drawUpdateWindow.xMin ) ,
		xMax: Math.min( this.ctx.canvas.width - 1 , this.drawUpdateWindow.xMax ) ,
		yMin: Math.max( 0 , this.drawUpdateWindow.yMin ) ,
		yMax: Math.min( this.ctx.canvas.height - 1 , this.drawUpdateWindow.yMax )
	} ;

	//console.warn( ".updatePreview() -- draw:" , this.drawWindow , "drawUpdate:" , this.drawUpdateWindow , "rect:" , rect ) ;
	if ( this.canvasPreviewImageManipulator !== this.accumulatorImageManipulator ) {
		this.accumulatorImageManipulator.compatibleCopyTo( this.canvasPreviewImageManipulator , rect ) ;
		//this.accumulatorImageManipulator.toMono( this.canvasPreviewImageManipulator ,rect ) ;
	}

	this.previewCtx.putImageData( this.canvasPreviewImageManipulator.object , 0 , 0 , rect.xMin , rect.yMin , rect.xMax - rect.xMin , rect.yMax - rect.yMin ) ;
} ;



CanvasEditor.prototype.addPolygonPoint = function( position , fromTexCoord = false ) {
	if ( fromTexCoord ) { this.fromTextureCoordinates( position ) ; }

	//console.warn( "new Polygon Point position:" , position ) ;
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
		ctx = this.previewCtx ;

	if ( this.polygonPoints.length < 2 ) { return ; }

	this.previewCtx.clearRect( 0 , 0 , this.previewCtx.canvas.width , this.previewCtx.canvas.height ) ;

	ctx.beginPath() ;
	dot = this.polygonPoints[ 0 ] ;
	ctx.moveTo( dot.x , dot.y ) ;

	for ( i = 1 ; i < this.polygonPoints.length ; i ++ ) {
		dot = this.polygonPoints[ i ] ;
		ctx.lineTo( dot.x , dot.y ) ;
	}

	ctx.closePath() ;

	ctx.fillStyle = '#ffffffff' ;
	ctx.fill() ;

	ctx.strokeStyle = '#000000ff' ;
	ctx.lineWidth = 1 ;
	ctx.stroke() ;

	this.updatePreviewFromCanvas() ;
	this.previewCtx.clearRect( 0 , 0 , this.previewCtx.canvas.width , this.previewCtx.canvas.height ) ;
	this.accumulatorImageManipulator.stripe( null , 'alpha' , [ 'mono' ] , 8 ) ;
	this.applyAccumulator() ;
} ;



CanvasEditor.prototype.updatePolygonPreview = function() {
	var from , to ,
		ctx = this.previewCtx ;

	if ( ! this.polygonPoints.length ) { return ; }

	if ( this.polygonPoints.length === 1 ) {
		to = this.polygonPoints[ this.polygonPoints.length - 1 ] ;

		ctx.beginPath() ;
		ctx.ellipse( to.x , to.y , 5 , 5 , 0 , 0 , 2 * Math.PI ) ;

		ctx.strokeStyle = '#ffffffff' ;
		ctx.lineWidth = 3 ;
		ctx.stroke() ;

		ctx.strokeStyle = '#000000ff' ;
		ctx.lineWidth = 1 ;
		ctx.stroke() ;
	}
	else {
		from = this.polygonPoints[ this.polygonPoints.length - 2 ] ;
		to = this.polygonPoints[ this.polygonPoints.length - 1 ] ;

		ctx.beginPath() ;
		ctx.moveTo( from.x , from.y ) ;
		ctx.lineTo( to.x , to.y ) ;

		ctx.strokeStyle = '#ffffffff' ;
		ctx.lineWidth = 3 ;
		ctx.stroke() ;

		ctx.strokeStyle = '#000000ff' ;
		ctx.lineWidth = 1 ;
		ctx.stroke() ;
	}
} ;



CanvasEditor.prototype.magicSelect = function( selectionCanvasEditor , position , fromTexCoord = false ) {
	if ( fromTexCoord ) { this.fromTextureCoordinates( position ) ; }
	
	this.imageManipulator.magicSelect(
		selectionCanvasEditor.accumulatorImageManipulator ,
		null ,	// Don't use area's mask here ,
		position.x ,
		position.y ,
		ImageManipulator.monoAlphaSelectOffset ,
		{
			channels: [ 'red' , 'green' , 'blue' ] ,
			tolerance: this.toolTolerance
		}
	) ;
	selectionCanvasEditor.accumulatorImageManipulator.stripe( null , 'alpha' , [ 'mono' ] , 8 ) ;
	selectionCanvasEditor.applyAccumulator() ;
	selectionCanvasEditor.pushHistory() ;

	this.updateToCanvas() ;
	this.pushHistory() ;
} ;



CanvasEditor.prototype.fill = function( position , fromTexCoord = false ) {
	if ( fromTexCoord ) { this.fromTextureCoordinates( position ) ; }
	
	var mask = this.getMaskImageManipulator() ,
		area = mask ? { mask } : null ;
	
	this.imageManipulator.fill( area , position.x , position.y , this.toolColor , this.toolTolerance ) ;

	this.updateToCanvas() ;
	this.pushHistory() ;
} ;



CanvasEditor.prototype.historyMix = function( params = {} ) {
	if ( ! this.historyIndex ) { return ; }

	var mask = this.getMaskImageManipulator() ,
		area = mask ? { mask } : null ;

	var inputImage = new ImageManipulator( null , this.imageManipulator.width , this.imageManipulator.height , this.imageManipulator.offsetToChannel ) ;
	inputImage.setData( this.history[ this.historyIndex - 1 ] ) ;

	inputImage.mixInto( this.imageManipulator , area , params.mix ) ;
	this.updateToCanvas() ;
	this.pushHistory() ;
} ;



CanvasEditor.prototype.brightnessFilter = function( inputImage ) {
	var mask = this.getMaskImageManipulator() ,
		area = mask ? { mask } : null ;

	inputImage.toMono( this.imageManipulator , area ) ;
	this.updateToCanvas() ;
	this.pushHistory() ;
} ;



CanvasEditor.prototype.alphaFilter = function( inputImage ) {
	var mask = this.getMaskImageManipulator() ,
		area = mask ? { mask } : null ;

	inputImage.alphaToMono( this.imageManipulator , area ) ;
	this.updateToCanvas() ;
	this.pushHistory() ;
} ;



CanvasEditor.prototype.alphaBevelHeightMapFilter = function( inputImage , params = {} ) {
	var undersampling = Math.round( + params.undersampling || 1 ) ,
		bevelParams = { radius: params.radius , transform: params.transform } ,
		mask = this.getMaskImageManipulator() ,
		area = mask ? { mask } : null ;

	if ( undersampling > 1 ) {
		let scaledArea = mask ? { mask: mask.scaleBilinear( null , 1 / undersampling ) } : null ;

		inputImage.scaleBilinear( null , 1 / undersampling )
			.alphaToMono()
			.bevel( null , scaledArea , bevelParams )
			.scaleBilinear( null , undersampling )
			.toMono( this.imageManipulator , area ) ;
	}
	else {
		inputImage.alphaToMono()
			.bevel( null , area , bevelParams )
			.toMono( this.imageManipulator , area ) ;
	}

	this.updateToCanvas() ;
	this.pushHistory() ;
} ;



CanvasEditor.prototype.heightMapToNormalFilter = function( inputImage , params = {} ) {
	var mask = this.getMaskImageManipulator() ,
		area = mask ? { mask } : null ;

	inputImage.toMono()
		.heightMapToNormal( null , area , { height: params.height } )
		.blur( null , area , { radius: 2 } )
		.copyTo( this.imageManipulator , area ) ;

	this.updateToCanvas() ;
	this.pushHistory() ;
} ;



CanvasEditor.prototype.normalizeNormalsFilter = function( params = {} ) {
	this.imageManipulator.normalizeNormals( params.keepXY ) ;
	this.updateToCanvas() ;
	this.pushHistory() ;
} ;



CanvasEditor.prototype.monoFilter = function() {
	var mask = this.getMaskImageManipulator() ,
		area = mask ? { mask } : null ;

	// Not sure it works in-place, so we have to use a temporary image
	this.imageManipulator.clone().toMono( this.imageManipulator , area ) ;

	this.updateToCanvas() ;
	this.pushHistory() ;
} ;



CanvasEditor.prototype.blurFilter = function( params = {} ) {
	var i ,
		currentImage = this.imageManipulator ,
		iteration = + params.iteration || 1 ,
		loopIteration = params.mono ? iteration : iteration - 1 ,
		blurParams = { radius: params.radius , erosion: !! params.erosion , alphaZero: !! params.alphaZero } ,
		mask = this.getMaskImageManipulator() ,
		area = mask ? { mask } : null ;

	if ( ! params.mono && iteration <= 1 ) {
		// It does not work in-place, so we have to use a temporary image
		currentImage = currentImage.clone() ;
	}

	if ( params.mono ) {
		currentImage = currentImage.toMono() ;
	}
	else if ( iteration <= 1 ) {
		// It does not work in-place, so we have to use a temporary image
		currentImage = currentImage.clone() ;
	}

	for ( i = 0 ; i < loopIteration ; i ++ ) {
		currentImage = currentImage.blur( null , area , blurParams ) ;
	}

	if ( params.mono ) { currentImage.toMono( this.imageManipulator ) ; }
	else { currentImage.blur( this.imageManipulator , area , blurParams ) ; }
	
	this.updateToCanvas() ;
	this.pushHistory() ;
} ;



CanvasEditor.prototype.fastBlurFilter = function( params = {} ) {
	var horizontal = !! ( params.horizontal ?? true ) ,
		vertical = !! ( params.vertical ?? true ) ,
		blurParams = { radius: params.radius , alphaZero: !! params.alphaZero } ;

	if ( ! horizontal && ! vertical ) { return ; }

	var mask = this.getMaskImageManipulator() ,
		area = mask ? { mask } : null ;

	if ( horizontal && vertical ) {
		this.imageManipulator.horizontalBlur( null , area , blurParams )
			.verticalBlur( this.imageManipulator , area , blurParams ) ;
	}
	else if ( horizontal ) {
		// It does not work in-place, so we have to use a temporary image
		this.imageManipulator.clone().horizontalBlur( this.imageManipulator , area , blurParams ) ;
	}
	else {
		// It does not work in-place, so we have to use a temporary image
		this.imageManipulator.clone().verticalBlur( this.imageManipulator , area , blurParams ) ;
	}

	this.updateToCanvas() ;
	this.pushHistory() ;
} ;

